import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { centralStock } from '../db/schema/central-stock';
import { products } from '../db/schema/products';
import { stockMovements } from '../db/schema/stock-movements';
import { ProductsService } from '../products/products.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import type { ConsumptionReportData } from './dto/consumption-report.dto';
import type { MealRankingData } from './dto/meal-ranking.dto';
import type { StockHistoryData } from './dto/stock-history.dto';

@Injectable()
export class DashboardService {
  constructor(
    private productsService: ProductsService,
    private stockMovementsService: StockMovementsService,
    private db: DbService,
  ) {}

  async getSummary() {
    const allProducts = await this.productsService.findAll();
    const totalProducts = allProducts.length;

    const [stockSum] = await this.db.db
      .select({
        total: sql<number>`coalesce(sum(${centralStock.quantity}), 0)`,
      })
      .from(centralStock);

    const totalStockItems = Number(stockSum?.total ?? 0);

    const lowStockData = await this.db.db
      .select({
        productId: centralStock.productId,
        productName: products.name,
        quantity: centralStock.quantity,
      })
      .from(centralStock)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(centralStock.productId, products.id))
      .where(lte(centralStock.quantity, 5));

    const lowStockAlerts = lowStockData.map((item) => ({
      ...item,
      threshold: 5,
    }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount] = await this.db.db
      .select({ count: sql<number>`count(*)` })
      .from(stockMovements)
      .where(gte(stockMovements.createdAt, todayStart));

    const todayMovements = Number(todayCount?.count ?? 0);

    const recentMovements = await this.stockMovementsService.findAll({
      page: 1,
      limit: 10,
    });

    return {
      totalProducts,
      totalStockItems,
      lowStockAlerts,
      todayMovements,
      recentMovements,
    };
  }

  async getConsumptionByRoom(filters: ConsumptionReportData) {
    const conditions = [eq(stockMovements.type, 'REPLENISH')];

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const rows = await this.db.db
      .select({
        room: stockMovements.room,
        productId: stockMovements.productId,
        productName: products.name,
        quantity: sql<number>`sum(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(stockMovements.productId, products.id))
      .where(and(...conditions))
      .groupBy(stockMovements.room, stockMovements.productId, products.name)
      .orderBy(stockMovements.room);

    const grouped: Record<
      number,
      { room: number; items: Array<{ productName: string; quantity: number }> }
    > = {};

    for (const row of rows) {
      if (row.room === null) continue;
      if (!grouped[row.room]) {
        grouped[row.room] = { room: row.room, items: [] };
      }
      grouped[row.room].items.push({
        productName: row.productName,
        quantity: Number(row.quantity),
      });
    }

    return Object.values(grouped);
  }

  async getMealRanking(filters: MealRankingData) {
    const conditions = [eq(stockMovements.type, 'MEAL_OUT')];

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const rows = await this.db.db
      .select({
        productId: stockMovements.productId,
        productName: products.name,
        productCategory: products.category,
        totalQuantity: sql<number>`sum(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(stockMovements.productId, products.id))
      .where(and(...conditions))
      .groupBy(stockMovements.productId, products.name, products.category)
      .orderBy(desc(sql`sum(${stockMovements.quantity})`))
      .limit(filters.limit);

    return rows.map((row) => ({
      ...row,
      totalQuantity: Number(row.totalQuantity),
    }));
  }

  async getStockHistory(productId: string, filters: StockHistoryData) {
    const conditions = [eq(stockMovements.productId, productId)];

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const rows = await this.db.db
      .select({
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .where(and(...conditions))
      .orderBy(stockMovements.createdAt);

    let balance = 0;
    return rows.map((row) => {
      if (row.type === 'IN') {
        balance += row.quantity;
      } else {
        balance -= row.quantity;
      }
      return {
        type: row.type,
        quantity: row.quantity,
        runningBalance: balance,
        createdAt: row.createdAt,
      };
    });
  }
}

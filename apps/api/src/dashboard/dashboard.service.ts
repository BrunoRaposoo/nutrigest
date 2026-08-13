import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { centralStock } from '../db/schema/central-stock';
import { products } from '../db/schema/products';
import { stockMovements } from '../db/schema/stock-movements';
import { ProductsService } from '../products/products.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import type { ChartsQueryData } from './dto/charts-query.dto';
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

  // -- CSV Helpers --

  private sanitizeCsvValue(value: string): string {
    if (/^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }

  private toCsv(
    data: Array<Record<string, unknown>>,
    columns: string[],
  ): string {
    const header = columns.join(',');
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          const str = String(val);
          const sanitized = this.sanitizeCsvValue(str);
          return sanitized.includes(',') ||
            sanitized.includes('"') ||
            sanitized.includes('\n')
            ? `"${sanitized.replace(/"/g, '""')}"`
            : sanitized;
        })
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  async getConsumptionByRoomCsv(
    filters: ConsumptionReportData,
  ): Promise<string> {
    const data = await this.getConsumptionByRoom(filters);
    const flat: Array<Record<string, unknown>> = [];
    for (const room of data) {
      for (const item of room.items) {
        flat.push({
          room: room.room,
          product: item.productName,
          quantity: item.quantity,
        });
      }
    }
    return this.toCsv(flat, ['room', 'product', 'quantity']);
  }

  async getMealRankingCsv(filters: MealRankingData): Promise<string> {
    const data = await this.getMealRanking(filters);
    return this.toCsv(data as unknown as Array<Record<string, unknown>>, [
      'productName',
      'productCategory',
      'totalQuantity',
    ]);
  }

  async getStockHistoryCsv(
    productId: string,
    filters: StockHistoryData,
  ): Promise<string> {
    const data = await this.getStockHistory(productId, filters);
    return this.toCsv(data as unknown as Array<Record<string, unknown>>, [
      'type',
      'quantity',
      'runningBalance',
      'createdAt',
    ]);
  }

  // -- Charts --

  async getMonthlyConsumption(filters: ChartsQueryData) {
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const rows = await this.db.db
      .select({
        month: sql<string>`to_char(${stockMovements.createdAt}, 'YYYY-MM')`,
        type: stockMovements.type,
        totalQuantity: sql<number>`sum(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      .where(and(...conditions))
      .groupBy(
        sql`to_char(${stockMovements.createdAt}, 'YYYY-MM')`,
        stockMovements.type,
      )
      .orderBy(sql`to_char(${stockMovements.createdAt}, 'YYYY-MM')`);

    const grouped: Record<
      string,
      { month: string; replenishQty: number; mealOutQty: number }
    > = {};

    for (const row of rows) {
      if (!grouped[row.month]) {
        grouped[row.month] = {
          month: row.month,
          replenishQty: 0,
          mealOutQty: 0,
        };
      }
      if (row.type === 'REPLENISH') {
        grouped[row.month].replenishQty += Number(row.totalQuantity);
      } else if (row.type === 'MEAL_OUT') {
        grouped[row.month].mealOutQty += Number(row.totalQuantity);
      }
    }

    return Object.values(grouped).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }

  async getRoomComparison(filters: ChartsQueryData) {
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
        totalQuantity: sql<number>`sum(${stockMovements.quantity})`,
      })
      .from(stockMovements)
      .where(and(...conditions))
      .groupBy(stockMovements.room)
      .orderBy(stockMovements.room);

    return rows
      .filter((r) => r.room !== null)
      .map((r) => ({
        room: r.room as number,
        totalQuantity: Number(r.totalQuantity),
      }));
  }

  async getCategoryDistribution() {
    const results = await this.db.db
      .select({
        category: products.category,
        quantity: sql<number>`coalesce(sum(${centralStock.quantity}), 0)`,
      })
      .from(centralStock)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(centralStock.productId, products.id))
      .groupBy(products.category);

    const beverage =
      results.find((r) => r.category === 'BEVERAGE')?.quantity ?? 0;
    const meal = results.find((r) => r.category === 'MEAL')?.quantity ?? 0;
    const total = Number(beverage) + Number(meal) || 1;

    return [
      {
        category: 'BEVERAGE',
        quantity: Number(beverage),
        percentage: Math.round((Number(beverage) / total) * 100),
      },
      {
        category: 'MEAL',
        quantity: Number(meal),
        percentage: Math.round((Number(meal) / total) * 100),
      },
    ];
  }

  async getStockEvolution(productId: string, filters: ChartsQueryData) {
    const conditions = [eq(stockMovements.productId, productId)];

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const rows = await this.db.db
      .select({
        date: sql<string>`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD')`,
        quantity: sql<number>`sum(${stockMovements.quantity})`,
        type: stockMovements.type,
      })
      .from(stockMovements)
      .where(and(...conditions))
      .groupBy(
        sql`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD')`,
        stockMovements.type,
      )
      .orderBy(sql`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD')`);

    const daily: Record<string, { date: string; quantity: number }> = {};
    let balance = 0;

    const initialIn = filters.from
      ? await this.db.db
          .select({
            total: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)`,
          })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.productId, productId),
              eq(stockMovements.type, 'IN'),
              lte(stockMovements.createdAt, new Date(filters.from)),
            ),
          )
      : [{ total: 0 }];

    const initialOut = filters.from
      ? await this.db.db
          .select({
            total: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)`,
          })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.productId, productId),
              sql`${stockMovements.type} != 'IN'`,
              lte(stockMovements.createdAt, new Date(filters.from)),
            ),
          )
      : [{ total: 0 }];

    balance =
      Number(initialIn[0]?.total ?? 0) - Number(initialOut[0]?.total ?? 0);

    for (const row of rows) {
      if (row.type === 'IN') {
        balance += Number(row.quantity);
      } else {
        balance -= Number(row.quantity);
      }
      daily[row.date] = { date: row.date, quantity: balance };
    }

    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }
}

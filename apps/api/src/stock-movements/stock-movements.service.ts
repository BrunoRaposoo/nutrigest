import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { CentralStockService } from '../central-stock/central-stock.service';
import { DbService } from '../db/db.service';
import { centralStock } from '../db/schema/central-stock';
import { products } from '../db/schema/products';
import { stockMovements } from '../db/schema/stock-movements';
import { users } from '../db/schema/users';
import type { CreateInMovementData } from './dto/create-in-movement.dto';
import type { CreateMealOutMovementData } from './dto/create-meal-out-movement.dto';
import type { CreateReplenishMovementData } from './dto/create-replenish-movement.dto';
import type { ListMovementsData } from './dto/list-movements.dto';

const VALID_ROOMS = Array.from({ length: 10 }, (_, i) => 101 + i);

@Injectable()
export class StockMovementsService {
  constructor(
    private db: DbService,
    private centralStockService: CentralStockService,
  ) {}

  async createIn(dto: CreateInMovementData, userId: string) {
    for (const item of dto.items) {
      await this.ensureProductExists(item.productId);
    }

    const created = await this.db.db.transaction(async (tx) => {
      const records = [];

      for (const item of dto.items) {
        const [movement] = await tx
          .insert(stockMovements)
          .values({
            type: 'IN',
            productId: item.productId,
            quantity: item.quantity,
            userId,
            description: dto.description ?? null,
          })
          .returning();

        await this.upsertCentralStock(tx, item.productId, item.quantity);

        records.push(movement);
      }

      return records;
    });

    return created;
  }

  async createReplenish(
    room: number,
    dto: CreateReplenishMovementData,
    userId: string,
  ) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    for (const item of dto.items) {
      await this.ensureProductExists(item.productId);
      if (item.restockedQuantity > 0) {
        const qty = await this.centralStockService.getQuantity(item.productId);
        if (qty < item.restockedQuantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}: available ${qty}, required ${item.restockedQuantity}`,
          );
        }
      }
    }

    const created = await this.db.db.transaction(async (tx) => {
      const records = [];

      for (const item of dto.items) {
        if (item.consumedQuantity > 0) {
          const [consumption] = await tx
            .insert(stockMovements)
            .values({
              type: 'CONSUMPTION',
              productId: item.productId,
              quantity: item.consumedQuantity,
              room,
              userId,
            })
            .returning();
          records.push(consumption);
        }

        if (item.restockedQuantity > 0) {
          const [replenish] = await tx
            .insert(stockMovements)
            .values({
              type: 'REPLENISH',
              productId: item.productId,
              quantity: item.restockedQuantity,
              room,
              userId,
            })
            .returning();

          await this.upsertCentralStock(
            tx,
            item.productId,
            -item.restockedQuantity,
          );

          records.push(replenish);
        }
      }

      return records;
    });

    return created;
  }

  async createMealOut(dto: CreateMealOutMovementData, userId: string) {
    await this.ensureProductExists(dto.productId);

    const qty = await this.centralStockService.getQuantity(dto.productId);
    if (qty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock: available ${qty}, required ${dto.quantity}`,
      );
    }

    const [movement] = await this.db.db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          type: 'MEAL_OUT',
          productId: dto.productId,
          quantity: dto.quantity,
          userId,
          description: dto.description,
        })
        .returning();

      await this.upsertCentralStock(tx, dto.productId, -dto.quantity);

      return [m];
    });

    return movement;
  }

  async findAll(filters: ListMovementsData) {
    const conditions = [];

    if (filters.type) {
      conditions.push(eq(stockMovements.type, filters.type));
    }

    if (filters.room) {
      conditions.push(eq(stockMovements.room, filters.room));
    }

    if (filters.from) {
      conditions.push(gte(stockMovements.createdAt, new Date(filters.from)));
    }

    if (filters.to) {
      conditions.push(lte(stockMovements.createdAt, new Date(filters.to)));
    }

    const offset = (filters.page - 1) * filters.limit;

    const result = await this.db.db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        productId: stockMovements.productId,
        productName: products.name,
        productCategory: products.category,
        quantity: stockMovements.quantity,
        room: stockMovements.room,
        userId: stockMovements.userId,
        userName: users.name,
        description: stockMovements.description,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(stockMovements.productId, products.id))
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(users as any, eq(stockMovements.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(filters.limit)
      .offset(offset);

    return result;
  }

  private async ensureProductExists(productId: string) {
    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction type
  private async upsertCentralStock(tx: any, productId: string, delta: number) {
    const [current] = await tx
      .select({ quantity: centralStock.quantity })
      .from(centralStock)
      .where(eq(centralStock.productId, productId))
      .limit(1);

    const newQuantity = (current?.quantity ?? 0) + delta;

    await tx
      .insert(centralStock)
      .values({ productId, quantity: newQuantity })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: { quantity: newQuantity, updatedAt: new Date() },
      });
  }
}

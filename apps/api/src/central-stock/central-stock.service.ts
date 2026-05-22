import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { centralStock } from '../db/schema/central-stock';
import { products } from '../db/schema/products';
import type { UpdateStockData } from './dto/update-stock.dto';

@Injectable()
export class CentralStockService {
  constructor(private db: DbService) {}

  async findAll() {
    const result = await this.db.db
      .select({
        productId: centralStock.productId,
        productName: products.name,
        productCategory: products.category,
        productImageUrl: products.imageUrl,
        quantity: centralStock.quantity,
        updatedAt: centralStock.updatedAt,
      })
      .from(centralStock)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(centralStock.productId, products.id))
      .orderBy(products.name);

    return result;
  }

  async findOne(productId: string) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const [stock] = await this.db.db
      .select({
        productId: centralStock.productId,
        productName: products.name,
        productCategory: products.category,
        productImageUrl: products.imageUrl,
        quantity: centralStock.quantity,
        updatedAt: centralStock.updatedAt,
      })
      .from(centralStock)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(centralStock.productId, products.id))
      .where(eq(centralStock.productId, productId))
      .limit(1);

    if (!stock) {
      return {
        productId: existing.id,
        productName: existing.name,
        productCategory: existing.category,
        productImageUrl: existing.imageUrl,
        quantity: 0,
        updatedAt: null,
      };
    }

    return stock;
  }

  async update(productId: string, dto: UpdateStockData) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.db.db
      .insert(centralStock)
      .values({ productId, quantity: dto.quantity })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: { quantity: dto.quantity, updatedAt: new Date() },
      });

    return this.findOne(productId);
  }

  async getQuantity(productId: string): Promise<number> {
    const [stock] = await this.db.db
      .select({ quantity: centralStock.quantity })
      .from(centralStock)
      .where(eq(centralStock.productId, productId))
      .limit(1);

    return stock?.quantity ?? 0;
  }

  async increment(productId: string, amount: number) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const currentQty = await this.getQuantity(productId);

    await this.db.db
      .insert(centralStock)
      .values({ productId, quantity: currentQty + amount })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: { quantity: currentQty + amount, updatedAt: new Date() },
      });
  }

  async decrement(productId: string, amount: number) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const currentQty = await this.getQuantity(productId);

    if (currentQty < amount) {
      throw new BadRequestException(
        `Insufficient stock: available ${currentQty}, required ${amount}`,
      );
    }

    await this.db.db
      .insert(centralStock)
      .values({ productId, quantity: currentQty - amount })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: { quantity: currentQty - amount, updatedAt: new Date() },
      });
  }
}

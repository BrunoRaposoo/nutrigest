import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { centralStock, products } from '../db/schema';
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
      .innerJoin(products, eq(centralStock.productId, products.id))
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
      .innerJoin(products, eq(centralStock.productId, products.id))
      .where(eq(centralStock.productId, productId))
      .limit(1);

    if (!stock) {
      throw new NotFoundException('Stock entry not found for this product');
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
}

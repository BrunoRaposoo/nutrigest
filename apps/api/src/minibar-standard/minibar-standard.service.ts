import { Injectable, NotFoundException } from '@nestjs/common';
import { VALID_ROOMS } from '@nutrigest/shared';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { minibarStandard } from '../db/schema/minibar-standard';
import { products } from '../db/schema/products';
import type { AddMinibarItemData } from './dto/add-minibar-item.dto';
import type { UpdateMinibarItemData } from './dto/update-minibar-item.dto';

@Injectable()
export class MinibarStandardService {
  constructor(private db: DbService) {}

  async findAll(room: number) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const result = await this.db.db
      .select({
        productId: minibarStandard.productId,
        productName: products.name,
        productCategory: products.category,
        productImageUrl: products.imageUrl,
        standardQuantity: minibarStandard.standardQuantity,
        createdAt: minibarStandard.createdAt,
      })
      .from(minibarStandard)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(minibarStandard.productId, products.id))
      .where(eq(minibarStandard.room, room));

    return result;
  }

  async add(room: number, dto: AddMinibarItemData) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, dto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [item] = await this.db.db
      .insert(minibarStandard)
      .values({
        room,
        productId: dto.productId,
        standardQuantity: dto.standardQuantity,
      })
      .onConflictDoUpdate({
        target: [minibarStandard.room, minibarStandard.productId],
        set: { standardQuantity: dto.standardQuantity },
      })
      .returning();

    return item;
  }

  async update(room: number, productId: string, dto: UpdateMinibarItemData) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [existing] = await this.db.db
      .select()
      .from(minibarStandard)
      .where(
        and(
          eq(minibarStandard.room, room),
          eq(minibarStandard.productId, productId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Minibar standard entry not found');
    }

    const [item] = await this.db.db
      .update(minibarStandard)
      .set({ standardQuantity: dto.standardQuantity })
      .where(
        and(
          eq(minibarStandard.room, room),
          eq(minibarStandard.productId, productId),
        ),
      )
      .returning();

    return item;
  }

  async remove(room: number, productId: string) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [existing] = await this.db.db
      .select()
      .from(minibarStandard)
      .where(
        and(
          eq(minibarStandard.room, room),
          eq(minibarStandard.productId, productId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Minibar standard entry not found');
    }

    await this.db.db
      .delete(minibarStandard)
      .where(
        and(
          eq(minibarStandard.room, room),
          eq(minibarStandard.productId, productId),
        ),
      );
  }
}

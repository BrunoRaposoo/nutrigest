import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CentralStockService } from '../central-stock/central-stock.service';
import { DbService } from '../db/db.service';
import { products } from '../db/schema';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service';
import type { CreateProductData } from './dto/create-product.dto';
import type { UpdateProductData } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private db: DbService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    private centralStockService: CentralStockService,
  ) {}

  async findAll() {
    return this.db.db.select().from(products);
  }

  async findOne(id: string) {
    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductData) {
    const [product] = await this.db.db
      .insert(products)
      .values({
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
      })
      .returning();

    await this.centralStockService.update(product.id, { quantity: 0 });

    return product;
  }

  async update(id: string, dto: UpdateProductData) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const values: Partial<typeof products.$inferInsert> = {};
    if (dto.name !== undefined) values.name = dto.name;
    if (dto.category !== undefined) values.category = dto.category;
    if (dto.unit !== undefined) values.unit = dto.unit;

    if (Object.keys(values).length === 0) {
      return existing;
    }

    const [product] = await this.db.db
      .update(products)
      .set(values)
      .where(eq(products.id, id))
      .returning();

    return product;
  }

  async remove(id: string) {
    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const stockQty = await this.centralStockService.getQuantity(id);
    if (stockQty > 0) {
      throw new BadRequestException(
        'Cannot delete product with existing stock. Adjust stock first.',
      );
    }

    if (product.imageUrl) {
      await this.storage.delete(product.imageUrl);
    }

    await this.db.db.delete(products).where(eq(products.id, id));

    return { message: 'Product deleted successfully' };
  }

  async uploadImage(
    id: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
  ) {
    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.imageUrl) {
      await this.storage.delete(product.imageUrl);
    }

    const imageUrl = await this.storage.upload(fileBuffer, fileName, mimeType);

    const [updated] = await this.db.db
      .update(products)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return updated;
  }

  async deleteImage(id: string) {
    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.imageUrl) {
      await this.storage.delete(product.imageUrl);
    }

    const [updated] = await this.db.db
      .update(products)
      .set({ imageUrl: null, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return updated;
  }
}

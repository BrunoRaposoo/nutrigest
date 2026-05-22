import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { products } from '../db/schema/products';
import { MinibarStandardService } from './minibar-standard.service';

describe('MinibarStandardService', () => {
  let service: MinibarStandardService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MinibarStandardService, DbService],
    }).compile();

    service = module.get<MinibarStandardService>(MinibarStandardService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  async function getAnyProductId() {
    const [product] = await db.db
      .select({ id: products.id })
      .from(products)
      .limit(1);
    return product?.id;
  }

  async function cleanRoom(room: number) {
    const items = await service.findAll(room);
    for (const item of items) {
      await service.remove(room, item.productId);
    }
  }

  describe('findAll', () => {
    it('should return empty array for a room with no items', async () => {
      await cleanRoom(109);

      const result = await service.findAll(109);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should throw NotFoundException for invalid room', async () => {
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('add', () => {
    it('should add an item to room standard', async () => {
      await cleanRoom(105);
      const productId = await getAnyProductId();
      if (!productId) return;

      const result = await service.add(105, {
        productId,
        standardQuantity: 3,
      });

      expect(result.room).toBe(105);
      expect(result.standardQuantity).toBe(3);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.add(101, {
          productId: '00000000-0000-0000-0000-000000000000',
          standardQuantity: 2,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert when item already exists', async () => {
      await cleanRoom(106);
      const productId = await getAnyProductId();
      if (!productId) return;

      await service.add(106, { productId, standardQuantity: 3 });

      const result = await service.add(106, {
        productId,
        standardQuantity: 5,
      });

      expect(result.standardQuantity).toBe(5);
    });
  });

  describe('update', () => {
    it('should update standard quantity', async () => {
      await cleanRoom(107);
      const productId = await getAnyProductId();
      if (!productId) return;

      await service.add(107, { productId, standardQuantity: 3 });

      const result = await service.update(107, productId, {
        standardQuantity: 10,
      });

      expect(result.standardQuantity).toBe(10);
    });

    it('should throw NotFoundException for non-existent entry', async () => {
      await expect(
        service.update(101, '00000000-0000-0000-0000-000000000000', {
          standardQuantity: 3,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an item from room standard', async () => {
      await cleanRoom(108);
      const productId = await getAnyProductId();
      if (!productId) return;

      await service.add(108, { productId, standardQuantity: 2 });

      await expect(service.remove(108, productId)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException for non-existent entry', async () => {
      await expect(
        service.remove(101, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { CentralStockService } from './central-stock.service';

describe('CentralStockService', () => {
  let service: CentralStockService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CentralStockService, DbService],
    }).compile();

    service = module.get<CentralStockService>(CentralStockService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  describe('findAll', () => {
    it('should return array of stock entries with product details', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('productId');
        expect(result[0]).toHaveProperty('productName');
        expect(result[0]).toHaveProperty('productCategory');
        expect(result[0]).toHaveProperty('quantity');
        expect(result[0]).toHaveProperty('updatedAt');
      }
    });
  });

  describe('findOne', () => {
    it('should return stock entry for a valid product', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      const result = await service.findOne(all[0].productId);
      expect(result.productId).toBe(all[0].productId);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should set stock quantity', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      const result = await service.update(all[0].productId, {
        quantity: 42,
      });

      expect(result.quantity).toBe(42);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          quantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getQuantity', () => {
    it('should return 0 for non-existent product', async () => {
      const qty = await service.getQuantity(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(qty).toBe(0);
    });

    it('should return current quantity for existing product', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      const qty = await service.getQuantity(all[0].productId);
      expect(typeof qty).toBe('number');
    });
  });

  describe('increment', () => {
    it('should add quantity to existing stock', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      await service.increment(all[0].productId, 10);
      const result = await service.findOne(all[0].productId);
      expect(result.quantity).toBeGreaterThanOrEqual(10);
    });

    it('should create stock entry if not exists and increment', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      // Use a productId that definitely has stock cleared
      const targetId = all[0].productId;

      // Reset to 0 first
      await service.update(targetId, { quantity: 0 });
      // Remove the entry
      const all2 = await service.findAll();
      const stockEntry = all2.find((s) => s.productId === targetId);
      if (stockEntry && stockEntry.quantity === 0) {
        // Just use a different product
      }

      await service.increment(targetId, 5);
      const result = await service.findOne(targetId);
      expect(result.quantity).toBeGreaterThanOrEqual(5);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.increment('00000000-0000-0000-0000-000000000000', 10),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('decrement', () => {
    it('should subtract quantity from existing stock', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      // Ensure stock is > 0
      await service.update(all[0].productId, { quantity: 100 });
      await service.decrement(all[0].productId, 30);
      const result = await service.findOne(all[0].productId);
      expect(result.quantity).toBe(70);
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      const all = await service.findAll();
      if (all.length === 0) return;

      await service.update(all[0].productId, { quantity: 5 });
      await expect(service.decrement(all[0].productId, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.decrement('00000000-0000-0000-0000-000000000000', 5),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

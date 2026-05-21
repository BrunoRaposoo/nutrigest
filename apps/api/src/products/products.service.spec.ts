import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, DbService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  describe('findAll', () => {
    it('should return array of products', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const result = await service.create({
        name: 'Test Beverage',
        category: 'BEVERAGE',
        unit: 'un',
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Beverage');
      expect(result.category).toBe('BEVERAGE');
    });

    it('should create product with default unit', async () => {
      const result = await service.create({
        name: 'Test Meal',
        category: 'MEAL',
      });

      expect(result.unit).toBe('un');
    });
  });

  describe('findOne', () => {
    it('should return product by id', async () => {
      const created = await service.create({
        name: 'FindOne Test',
        category: 'BEVERAGE',
      });

      const result = await service.findOne(created.id);
      expect(result.id).toBe(created.id);
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product name', async () => {
      const created = await service.create({
        name: 'Old Name',
        category: 'MEAL',
      });

      const result = await service.update(created.id, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should update product category', async () => {
      const created = await service.create({
        name: 'Category Change',
        category: 'BEVERAGE',
      });

      const result = await service.update(created.id, {
        category: 'MEAL',
      });

      expect(result.category).toBe('MEAL');
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          name: 'Ghost',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a product', async () => {
      const created = await service.create({
        name: 'Delete Test',
        category: 'BEVERAGE',
      });

      const result = await service.remove(created.id);
      expect(result).toHaveProperty('message');

      await expect(service.findOne(created.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id', async () => {
      await expect(
        service.remove('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

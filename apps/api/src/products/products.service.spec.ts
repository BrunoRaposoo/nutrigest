import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CentralStockService } from '../central-stock/central-stock.service';
import { DbService } from '../db/db.service';
import { stockMovements } from '../db/schema/stock-movements';
import { users } from '../db/schema/users';
import { LocalStorageService } from '../storage/local-storage.service';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let db: DbService;
  let centralStockService: CentralStockService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ProductsService,
        DbService,
        CentralStockService,
        {
          provide: STORAGE_SERVICE,
          useClass: LocalStorageService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    centralStockService = module.get<CentralStockService>(CentralStockService);
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

    it('should throw BadRequestException when stock > 0', async () => {
      const created = await service.create({
        name: 'Stock Block Test',
        category: 'BEVERAGE',
      });

      await centralStockService.update(created.id, { quantity: 5 });

      await expect(service.remove(created.id)).rejects.toThrow(
        BadRequestException,
      );

      // Reset stock so cleanup works
      await centralStockService.update(created.id, { quantity: 0 });
    });

    it('should throw BadRequestException when product has stock movements', async () => {
      const created = await service.create({
        name: 'Movements Block Test',
        category: 'BEVERAGE',
      });

      const [user] = await db.db
        .insert(users)
        .values({
          name: 'Mov User',
          email: `mov-product-${Date.now()}@example.com`,
          passwordHash: 'hash',
          role: 'OPERATOR',
        })
        .returning({ id: users.id });

      await db.db.insert(stockMovements).values({
        type: 'IN',
        productId: created.id,
        quantity: 10,
        userId: user.id,
      });

      await expect(service.remove(created.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadImage', () => {
    it('should upload image to a product', async () => {
      const created = await service.create({
        name: 'Image Test',
        category: 'BEVERAGE',
      });

      const result = await service.uploadImage(
        created.id,
        Buffer.from('fake-image-content'),
        'test.png',
        'image/png',
      );

      expect(result.imageUrl).toBeTruthy();
      expect(result.imageUrl).toMatch(/^\/uploads\//);
    });

    it('should replace existing image', async () => {
      const created = await service.create({
        name: 'Replace Image',
        category: 'MEAL',
      });

      const first = await service.uploadImage(
        created.id,
        Buffer.from('first'),
        'first.png',
        'image/png',
      );

      const second = await service.uploadImage(
        created.id,
        Buffer.from('second'),
        'second.png',
        'image/png',
      );

      expect(second.imageUrl).not.toBe(first.imageUrl);
    });

    it('should throw NotFoundException for invalid product', async () => {
      await expect(
        service.uploadImage(
          '00000000-0000-0000-0000-000000000000',
          Buffer.from('test'),
          'test.png',
          'image/png',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteImage', () => {
    it('should remove image from product', async () => {
      const created = await service.create({
        name: 'Delete Image Test',
        category: 'BEVERAGE',
      });

      await service.uploadImage(
        created.id,
        Buffer.from('test'),
        'test.png',
        'image/png',
      );

      const result = await service.deleteImage(created.id);
      expect(result.imageUrl).toBeNull();
    });

    it('should be idempotent when product has no image', async () => {
      const created = await service.create({
        name: 'No Image',
        category: 'MEAL',
      });

      const result = await service.deleteImage(created.id);
      expect(result.imageUrl).toBeNull();
    });

    it('should throw NotFoundException for invalid product', async () => {
      await expect(
        service.deleteImage('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

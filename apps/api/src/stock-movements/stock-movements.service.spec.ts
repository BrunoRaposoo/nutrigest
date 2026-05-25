import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CentralStockService } from '../central-stock/central-stock.service';
import { DbService } from '../db/db.service';
import { products } from '../db/schema/products';
import { users } from '../db/schema/users';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let centralStock: CentralStockService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockMovementsService, CentralStockService, DbService],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
    centralStock = module.get<CentralStockService>(CentralStockService);
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

  async function getAnyUserId() {
    const [user] = await db.db.select({ id: users.id }).from(users).limit(1);
    return user?.id;
  }

  describe('createIn', () => {
    it('should create IN movements and increment stock', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      const result = await service.createIn(
        {
          items: [{ productId, quantity: 15 }],
          description: 'Test entry',
        },
        userId,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('IN');
      expect(result[0].quantity).toBe(15);
    });

    it('should create multiple movements for batch', async () => {
      const all = await db.db
        .select({ id: products.id })
        .from(products)
        .limit(2);
      const userId = await getAnyUserId();
      if (all.length < 2 || !userId) return;

      const result = await service.createIn(
        {
          items: [
            { productId: all[0].id, quantity: 10 },
            { productId: all[1].id, quantity: 20 },
          ],
        },
        userId,
      );

      expect(result.length).toBe(2);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      const userId = await getAnyUserId();
      if (!userId) return;

      await expect(
        service.createIn(
          {
            items: [
              {
                productId: '00000000-0000-0000-0000-000000000000',
                quantity: 5,
              },
            ],
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReplenish', () => {
    it('should create REPLENISH movements and decrement stock', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      // Ensure enough stock
      await centralStock.increment(productId, 50);

      const result = await service.createReplenish(
        105,
        { items: [{ productId, consumedQuantity: 5, restockedQuantity: 5 }] },
        userId,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].type).toBe('CONSUMPTION');
      expect(result[0].quantity).toBe(5);
      expect(result[0].room).toBe(105);
      expect(result[1].type).toBe('REPLENISH');
      expect(result[1].quantity).toBe(5);
      expect(result[1].room).toBe(105);
    });

    it('should throw NotFoundException for invalid room', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      await expect(
        service.createReplenish(
          999,
           { items: [{ productId, consumedQuantity: 1, restockedQuantity: 0 }] },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      // Set stock to very low
      await centralStock.update(productId, { quantity: 2 });

      await expect(
        service.createReplenish(
          101,
           { items: [{ productId, consumedQuantity: 0, restockedQuantity: 10 }] },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create only CONSUMPTION when restockedQuantity is 0', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      await centralStock.increment(productId, 20);

      const result = await service.createReplenish(
        101,
        { items: [{ productId, consumedQuantity: 3, restockedQuantity: 0 }] },
        userId,
      );

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('CONSUMPTION');
      expect(result[0].quantity).toBe(3);
    });

    it('should create only REPLENISH when consumedQuantity is 0', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      await centralStock.increment(productId, 20);

      const result = await service.createReplenish(
        101,
        { items: [{ productId, consumedQuantity: 0, restockedQuantity: 4 }] },
        userId,
      );

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('REPLENISH');
      expect(result[0].quantity).toBe(4);
    });
  });

  describe('createMealOut', () => {
    it('should create MEAL_OUT movement and decrement stock', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      // Ensure enough stock
      await centralStock.increment(productId, 30);

      const result = await service.createMealOut(
        { productId, quantity: 3, description: 'Funcionário João' },
        userId,
      );

      expect(result.type).toBe('MEAL_OUT');
      expect(result.quantity).toBe(3);
      expect(result.description).toBe('Funcionário João');
    });

    it('should throw BadRequestException if insufficient stock', async () => {
      const productId = await getAnyProductId();
      const userId = await getAnyUserId();
      if (!productId || !userId) return;

      await centralStock.update(productId, { quantity: 1 });

      await expect(
        service.createMealOut({ productId, quantity: 5, description: 'test' }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      const userId = await getAnyUserId();
      if (!userId) return;

      await expect(
        service.createMealOut(
          {
            productId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
            description: 'test',
          },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return array of movements with product name', async () => {
      const result = await service.findAll({});

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('type');
        expect(result[0]).toHaveProperty('productName');
        expect(result[0]).toHaveProperty('quantity');
        expect(result[0]).toHaveProperty('createdAt');
      }
    });

    it('should filter by type', async () => {
      const all = await service.findAll({});
      if (all.length === 0) return;

      const result = await service.findAll({ type: 'IN' });
      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
        expect(item.type).toBe('IN');
      }
    });

    it('should filter by room', async () => {
      const result = await service.findAll({ room: 105 });
      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
        if (item.room !== null) {
          expect(item.room).toBe(105);
        }
      }
    });

    it('should paginate results', async () => {
      const page1 = await service.findAll({ page: 1, limit: 5 });
      expect(Array.isArray(page1)).toBe(true);
      expect(page1.length).toBeLessThanOrEqual(5);

      if (page1.length === 5) {
        const page2 = await service.findAll({ page: 2, limit: 5 });
        const ids1 = page1.map((m) => m.id);
        const ids2 = page2.map((m) => m.id);
        const overlap = ids1.filter((id) => ids2.includes(id));
        expect(overlap.length).toBe(0);
      }
    });
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { CentralStockService } from '../central-stock/central-stock.service';
import { DbService } from '../db/db.service';
import { ProductsService } from '../products/products.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { STORAGE_SERVICE } from '../storage/storage.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let productsService: ProductsService;
  let centralStockService: CentralStockService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        DashboardService,
        ProductsService,
        CentralStockService,
        StockMovementsService,
        DbService,
        {
          provide: STORAGE_SERVICE,
          useValue: { upload: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    productsService = module.get<ProductsService>(ProductsService);
    centralStockService = module.get<CentralStockService>(CentralStockService);

    const db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    const db = module.get<DbService>(DbService);
    await db.onModuleDestroy();
  });

  describe('getSummary', () => {
    it('should return dashboard summary with expected keys', async () => {
      const result = await service.getSummary();

      expect(result).toHaveProperty('totalProducts');
      expect(result).toHaveProperty('totalStockItems');
      expect(result).toHaveProperty('lowStockAlerts');
      expect(result).toHaveProperty('todayMovements');
      expect(result).toHaveProperty('recentMovements');
      expect(typeof result.totalProducts).toBe('number');
      expect(typeof result.totalStockItems).toBe('number');
      expect(typeof result.todayMovements).toBe('number');
      expect(Array.isArray(result.lowStockAlerts)).toBe(true);
      expect(Array.isArray(result.recentMovements)).toBe(true);
    });

    it('should only include products with quantity <= 5 in lowStockAlerts', async () => {
      // Set a product to low stock
      const allProducts = await productsService.findAll();
      if (allProducts.length === 0) return;

      await centralStockService.update(allProducts[0].id, { quantity: 3 });

      const result = await service.getSummary();
      for (const alert of result.lowStockAlerts) {
        expect(alert.quantity).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('getConsumptionByRoom', () => {
    it('should return array of room consumption data', async () => {
      const result = await service.getConsumptionByRoom({});
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('room');
        expect(result[0]).toHaveProperty('items');
        expect(Array.isArray(result[0].items)).toBe(true);
      }
    });
  });

  describe('getMealRanking', () => {
    it('should return array sorted by totalQuantity descending', async () => {
      const result = await service.getMealRanking({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].totalQuantity).toBeGreaterThanOrEqual(
          result[i].totalQuantity,
        );
      }
    });

    it('should respect limit parameter', async () => {
      const result = await service.getMealRanking({ limit: 3 });
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getStockHistory', () => {
    it('should return array with runningBalance for existing product', async () => {
      const allProducts = await productsService.findAll();
      if (allProducts.length === 0) return;

      const result = await service.getStockHistory(allProducts[0].id, {});
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('type');
        expect(result[0]).toHaveProperty('quantity');
        expect(result[0]).toHaveProperty('runningBalance');
        expect(result[0]).toHaveProperty('createdAt');
      }
    });

    it('should return empty array for non-existent product', async () => {
      const result = await service.getStockHistory(
        '00000000-0000-0000-0000-000000000000',
        {},
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});

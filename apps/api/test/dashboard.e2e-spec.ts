import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('Dashboard (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndLogin(
    role: 'ADMIN' | 'TECHNICIAN' | 'OPERATOR' = 'OPERATOR',
  ) {
    const email = `e2e-db-${role}-${Date.now()}-${Math.random()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: `${role} User`, email, password: 'password123', role },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    return JSON.parse(loginRes.body);
  }

  async function createProduct(accessToken: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: `DB E2E ${Date.now()}`, category: 'BEVERAGE' },
    });
    return JSON.parse(res.body);
  }

  describe('GET /dashboard/summary', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/summary',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/summary',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return summary for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/summary',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('totalProducts');
      expect(body).toHaveProperty('totalStockItems');
      expect(body).toHaveProperty('lowStockAlerts');
      expect(body).toHaveProperty('todayMovements');
      expect(body).toHaveProperty('recentMovements');
    });
  });

  describe('GET /dashboard/consumption-by-room', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/consumption-by-room',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/consumption-by-room',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return consumption data for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/consumption-by-room',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });
  });

  describe('GET /dashboard/meal-ranking', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/meal-ranking',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/meal-ranking',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return meal ranking for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/meal-ranking',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });
  });

  describe('GET /dashboard/stock-history/:productId', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/stock-history/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/stock-history/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return stock history for existing product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/dashboard/stock-history/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should return empty array for non-existent product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/stock-history/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });
  });

  // -- CSV Export --

  describe('GET /dashboard/consumption-by-room/csv', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/consumption-by-room/csv',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return CSV for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/consumption-by-room/csv',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('room,product,quantity');
    });
  });

  describe('GET /dashboard/meal-ranking/csv', () => {
    it('should return CSV for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/meal-ranking/csv',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('productName,productCategory,totalQuantity');
    });
  });

  describe('GET /dashboard/stock-history/:productId/csv', () => {
    it('should return CSV for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/dashboard/stock-history/${product.id}/csv`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('type,quantity,runningBalance,createdAt');
    });
  });

  // -- Charts --

  describe('GET /dashboard/charts/monthly-consumption', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/charts/monthly-consumption',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/charts/monthly-consumption',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return monthly consumption data for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/charts/monthly-consumption',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('month');
        expect(body[0]).toHaveProperty('replenishQty');
        expect(body[0]).toHaveProperty('mealOutQty');
      }
    });
  });

  describe('GET /dashboard/charts/room-comparison', () => {
    it('should return room comparison for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/charts/room-comparison',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('room');
        expect(body[0]).toHaveProperty('totalQuantity');
      }
    });
  });

  describe('GET /dashboard/charts/category-distribution', () => {
    it('should return category distribution for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/charts/category-distribution',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body[0]).toHaveProperty('category');
      expect(body[0]).toHaveProperty('quantity');
      expect(body[0]).toHaveProperty('percentage');
    });
  });

  describe('GET /dashboard/charts/stock-evolution/:productId', () => {
    it('should return stock evolution for ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/dashboard/charts/stock-evolution/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });
});

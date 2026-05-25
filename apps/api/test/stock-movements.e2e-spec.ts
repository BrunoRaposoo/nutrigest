import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('StockMovements (e2e)', () => {
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
    const email = `e2e-sm-${role}-${Date.now()}-${Math.random()}@example.com`;

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
      payload: { name: `SM E2E ${Date.now()}`, category: 'BEVERAGE' },
    });
    return JSON.parse(res.body);
  }

  describe('GET /stock-movements', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/stock-movements',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return empty array when no movements', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/stock-movements',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });
  });

  describe('POST /stock-movements/in', () => {
    it('should create IN movements and return 201', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [{ productId: product.id, quantity: 50 }],
          description: 'Nota fiscal #123',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].type).toBe('IN');
      expect(body[0].quantity).toBe(50);
    });

    it('should create batch IN movements', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const p1 = await createProduct(accessToken);
      const p2 = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [
            { productId: p1.id, quantity: 30 },
            { productId: p2.id, quantity: 20 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).length).toBe(2);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');
      const admin = await registerAndLogin('ADMIN');
      const product = await createProduct(admin.accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [{ productId: product.id, quantity: 10 }],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [
            {
              productId: '00000000-0000-0000-0000-000000000000',
              quantity: 10,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject empty items array', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { items: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /stock-movements/replenish/:room', () => {
    it('should create REPLENISH movements and return 201', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      // Ensure enough stock
      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 100 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/replenish/105',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [
            {
              productId: product.id,
              consumedQuantity: 5,
              restockedQuantity: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body[0].type).toBe('CONSUMPTION');
      expect(body[0].room).toBe(105);
      expect(body[0].quantity).toBe(5);
      expect(body[1].type).toBe('REPLENISH');
      expect(body[1].room).toBe(105);
      expect(body[1].quantity).toBe(5);
    });

    it('should allow OPERATOR', async () => {
      const admin = await registerAndLogin('ADMIN');
      const operator = await registerAndLogin('OPERATOR');
      const product = await createProduct(admin.accessToken);

      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { quantity: 50 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/replenish/101',
        headers: { authorization: `Bearer ${operator.accessToken}` },
        payload: {
          items: [
            {
              productId: product.id,
              consumedQuantity: 3,
              restockedQuantity: 3,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should return 400 if insufficient stock', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      // Set stock to very low
      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 1 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/replenish/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [
            {
              productId: product.id,
              consumedQuantity: 0,
              restockedQuantity: 10,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for invalid room', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/replenish/999',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          items: [
            {
              productId: product.id,
              consumedQuantity: 0,
              restockedQuantity: 1,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /stock-movements/meal-out', () => {
    it('should create MEAL_OUT movement and return 201', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      // Ensure enough stock
      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 30 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/meal-out',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: product.id,
          quantity: 5,
          description: 'E2E Test Meal',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.type).toBe('MEAL_OUT');
      expect(body.quantity).toBe(5);
    });

    it('should allow OPERATOR', async () => {
      const admin = await registerAndLogin('ADMIN');
      const operator = await registerAndLogin('OPERATOR');
      const product = await createProduct(admin.accessToken);

      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { quantity: 20 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/meal-out',
        headers: { authorization: `Bearer ${operator.accessToken}` },
        payload: {
          productId: product.id,
          quantity: 2,
          description: 'Operator meal',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should return 400 if insufficient stock', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/meal-out',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: product.id,
          quantity: 999,
          description: 'Too many',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/stock-movements/meal-out',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
          description: 'not found',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /stock-movements after creating data', () => {
    it('should return movements with filters', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      // Create some movements
      await app.inject({
        method: 'POST',
        url: '/stock-movements/in',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { items: [{ productId: product.id, quantity: 100 }] },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/stock-movements?type=IN',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      for (const item of body) {
        expect(item.type).toBe('IN');
        expect(item).toHaveProperty('productName');
        expect(item).toHaveProperty('userName');
      }
    });

    it('should paginate results', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/stock-movements?page=1&limit=5',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.length).toBeLessThanOrEqual(5);
    });
  });
});

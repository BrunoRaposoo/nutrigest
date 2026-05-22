import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('MinibarStandard (e2e)', () => {
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
    const email = `e2e-ms-${role}-${Date.now()}-${Math.random()}@example.com`;

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
      payload: { name: `MS E2E ${Date.now()}`, category: 'BEVERAGE' },
    });
    return JSON.parse(res.body);
  }

  describe('GET /minibar-standard/rooms', () => {
    it('should return list of rooms 101-110', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/rooms',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([
        101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
      ]);
    });
  });

  describe('GET /minibar-standard/:room', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/101',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return empty array for room with no items', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });

    it('should return 404 for invalid room', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/999',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /minibar-standard/:room', () => {
    it('should add item to room standard', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.room).toBe(101);
      expect(body.standardQuantity).toBe(3);
    });

    it('should upsert when item already exists', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/102',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/102',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 5 },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).standardQuantity).toBe(5);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000000',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000001',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject invalid room', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/999',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000001',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /minibar-standard/:room/:productId', () => {
    it('should update standard quantity', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/103',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/minibar-standard/103/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { standardQuantity: 10 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).standardQuantity).toBe(10);
    });

    it('should return 404 for non-existent entry', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: '/minibar-standard/101/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { standardQuantity: 5 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /minibar-standard/:room/:productId', () => {
    it('should remove item from room standard', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/104',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 2 },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/minibar-standard/104/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 for non-existent entry', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'DELETE',
        url: '/minibar-standard/101/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});

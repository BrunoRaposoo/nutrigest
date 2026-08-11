import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';
import { registerAndLogin } from './helpers/auth.helper';

describe('CentralStock (e2e)', () => {
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

  async function createProduct(accessToken: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: `Stock E2E ${Date.now()}`, category: 'BEVERAGE' },
    });
    return JSON.parse(res.body);
  }

  describe('GET /central-stock', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/central-stock' });
      expect(res.statusCode).toBe(401);
    });

    it('should list stock for ADMIN', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      await createProduct(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: '/central-stock',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('productId');
        expect(body[0]).toHaveProperty('productName');
        expect(body[0]).toHaveProperty('quantity');
      }
    });

    it('should list stock for OPERATOR', async () => {
      const { accessToken } = await registerAndLogin(app, 'OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/central-stock',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /central-stock/:productId', () => {
    it('should get stock by product ID', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).productId).toBe(product.id);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/central-stock/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /central-stock/:productId', () => {
    it('should update stock as ADMIN', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 50 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).quantity).toBe(50);
    });

    it('should update stock as TECHNICIAN', async () => {
      const { accessToken } = await registerAndLogin(app, 'TECHNICIAN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 30 },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should reject update as OPERATOR', async () => {
      const admin = await registerAndLogin(app, 'ADMIN');
      const operator = await registerAndLogin(app, 'OPERATOR');
      const product = await createProduct(admin.accessToken);

      const res = await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${operator.accessToken}` },
        payload: { quantity: 10 },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject negative quantity', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: -1 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: '/central-stock/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 10 },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should create stock entry if not exists', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'PATCH',
        url: `/central-stock/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 25 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).quantity).toBe(25);
    });
  });
});

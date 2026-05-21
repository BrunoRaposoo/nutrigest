import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('Products (e2e)', () => {
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
    const email = `e2e-prod-${role}-${Date.now()}-${Math.random()}@example.com`;

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

  describe('/products (GET) - list', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/products' });
      expect(res.statusCode).toBe(401);
    });

    it('should list products for OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    });
  });

  describe('/products (POST) - create', () => {
    it('should create product as ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Admin Product', category: 'BEVERAGE' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Admin Product');
    });

    it('should create product as TECHNICIAN', async () => {
      const { accessToken } = await registerAndLogin('TECHNICIAN');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Tech Product', category: 'MEAL' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should reject create as OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'No Perm', category: 'BEVERAGE' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should validate required fields', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('/products/:id (GET) - get one', () => {
    it('should get product by id', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Get Test', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'GET',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(created.id);
    });

    it('should return 404 for non-existent id', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/products/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('/products/:id (PATCH) - update', () => {
    it('should update product as ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Old', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('Updated');
    });

    it('should reject update as OPERATOR', async () => {
      const admin = await registerAndLogin('ADMIN');
      const operator = await registerAndLogin('OPERATOR');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { name: 'Fixed', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${operator.accessToken}` },
        payload: { name: 'Hacked' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('/products/:id (DELETE) - delete', () => {
    it('should delete product as ADMIN', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'To Delete', category: 'MEAL' },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);

      const checkRes = await app.inject({
        method: 'GET',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(checkRes.statusCode).toBe(404);
    });

    it('should reject delete as TECHNICIAN', async () => {
      const { accessToken } = await registerAndLogin('TECHNICIAN');

      const res = await app.inject({
        method: 'DELETE',
        url: '/products/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

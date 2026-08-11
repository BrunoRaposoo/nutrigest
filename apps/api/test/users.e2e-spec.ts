import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';
import { registerAndLogin } from './helpers/auth.helper';

describe('Users (e2e)', () => {
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

  describe('/users (GET) - list users', () => {
    it('should reject unauthenticated request', async () => {
      const res = await app.inject({ method: 'GET', url: '/users' });
      expect(res.statusCode).toBe(401);
    });

    it('should reject non-admin user', async () => {
      const { accessToken } = await registerAndLogin(app, 'OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should list users for admin', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id');
        expect(body[0]).toHaveProperty('email');
        expect(body[0]).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('/users/:id (GET) - get user', () => {
    it('should get user by id as admin', async () => {
      const admin = await registerAndLogin(app, 'ADMIN');

      const listRes = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
      const usersList = JSON.parse(listRes.body);
      const targetId = usersList[0].id;

      const res = await app.inject({
        method: 'GET',
        url: `/users/${targetId}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(targetId);
    });

    it('should return 404 for non-existent id', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'GET',
        url: '/users/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('/users (POST) - create user', () => {
    it('should create user as admin', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'New User',
          email: `e2e-create-${Date.now()}@example.com`,
          password: 'password123',
          role: 'TECHNICIAN',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('id');
      expect(body.role).toBe('TECHNICIAN');
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');
      const email = `e2e-create-dup-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'First', email, password: 'password123' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Second', email, password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('/users/:id (PATCH) - update user', () => {
    it('should update user name as admin', async () => {
      const admin = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: {
          name: 'Old Name',
          email: `e2e-update-${Date.now()}@example.com`,
          password: 'password123',
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${created.id}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('New Name');
    });
  });

  describe('/users/:id (DELETE) - delete user', () => {
    it('should delete user as admin', async () => {
      const admin = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: {
          name: 'To Delete',
          email: `e2e-delete-${Date.now()}@example.com`,
          password: 'password123',
        },
      });
      const created = JSON.parse(createRes.body);

      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${created.id}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('message');

      const checkRes = await app.inject({
        method: 'GET',
        url: `/users/${created.id}`,
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
      expect(checkRes.statusCode).toBe(404);
    });
  });

  describe('RBAC - role-based access', () => {
    it('should reject OPERATOR from listing users', async () => {
      const { accessToken } = await registerAndLogin(app, 'OPERATOR');

      const res = await app.inject({
        method: 'GET',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject TECHNICIAN from creating users', async () => {
      const { accessToken } = await registerAndLogin(app, 'TECHNICIAN');

      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          name: 'Should Not Work',
          email: `e2e-rbac-${Date.now()}@example.com`,
          password: 'password123',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});

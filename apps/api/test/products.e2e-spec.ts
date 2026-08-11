import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';
import { registerAndLogin } from './helpers/auth.helper';

function buildMultipartBody(
  filename: string,
  mimeType: string,
  content?: Buffer,
): { body: Buffer; boundary: string } {
  const boundary = `----WebKitFormBoundary${randomBytes(8).toString('hex')}`;
  const fileContent = content || Buffer.from('fake-image-content');

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `\r\n`,
  );

  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);

  return { body: Buffer.concat([preamble, fileContent, epilogue]), boundary };
}

describe('Products (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyStatic, {
      root: join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads'),
      prefix: '/uploads/',
      decorateReply: false,
    });

    await app.register(fastifyMultipart, {
      limits: {
        fileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
      },
    });

    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/products (GET) - list', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/products' });
      expect(res.statusCode).toBe(401);
    });

    it('should list products for OPERATOR', async () => {
      const { accessToken } = await registerAndLogin(app, 'OPERATOR');

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
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const { accessToken } = await registerAndLogin(app, 'TECHNICIAN');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Tech Product', category: 'MEAL' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should reject create as OPERATOR', async () => {
      const { accessToken } = await registerAndLogin(app, 'OPERATOR');

      const res = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'No Perm', category: 'BEVERAGE' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should validate required fields', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const admin = await registerAndLogin(app, 'ADMIN');
      const operator = await registerAndLogin(app, 'OPERATOR');

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
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

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
      const { accessToken } = await registerAndLogin(app, 'TECHNICIAN');

      const res = await app.inject({
        method: 'DELETE',
        url: '/products/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject delete when stock > 0', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Stock Protect', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 5 },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/products/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(400);

      await app.inject({
        method: 'PATCH',
        url: `/central-stock/${created.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { quantity: 0 },
      });
    });
  });

  describe('/products/:id/image (POST) - upload image', () => {
    it('should upload image as ADMIN', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Img Admin', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const { body, boundary } = buildMultipartBody('test.png', 'image/png');

      const res = await app.inject({
        method: 'POST',
        url: `/products/${created.id}/image`,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.statusCode).toBe(201);
      const parsed = JSON.parse(res.body);
      expect(parsed.imageUrl).toMatch(/^\/uploads\//);
    });

    it('should upload image as TECHNICIAN', async () => {
      const { accessToken } = await registerAndLogin(app, 'TECHNICIAN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Img Tech', category: 'MEAL' },
      });
      const created = JSON.parse(createRes.body);

      const { body, boundary } = buildMultipartBody('test.png', 'image/png');

      const res = await app.inject({
        method: 'POST',
        url: `/products/${created.id}/image`,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.statusCode).toBe(201);
    });

    it('should reject upload as OPERATOR', async () => {
      const admin = await registerAndLogin(app, 'ADMIN');
      const operator = await registerAndLogin(app, 'OPERATOR');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${admin.accessToken}` },
        payload: { name: 'Img NoPerm', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const { body, boundary } = buildMultipartBody('test.png', 'image/png');

      const res = await app.inject({
        method: 'POST',
        url: `/products/${created.id}/image`,
        headers: {
          authorization: `Bearer ${operator.accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const { body, boundary } = buildMultipartBody('test.png', 'image/png');

      const res = await app.inject({
        method: 'POST',
        url: '/products/00000000-0000-0000-0000-000000000000/image',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject invalid file type', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Bad File', category: 'BEVERAGE' },
      });
      const created = JSON.parse(createRes.body);

      const { body, boundary } = buildMultipartBody(
        'test.pdf',
        'application/pdf',
      );

      const res = await app.inject({
        method: 'POST',
        url: `/products/${created.id}/image`,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('/products/:id/image (DELETE) - delete image', () => {
    it('should delete product image', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const createRes = await app.inject({
        method: 'POST',
        url: '/products',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Del Img', category: 'MEAL' },
      });
      const created = JSON.parse(createRes.body);

      const { body, boundary } = buildMultipartBody('test.png', 'image/png');

      await app.inject({
        method: 'POST',
        url: `/products/${created.id}/image`,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/products/${created.id}/image`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.imageUrl).toBeNull();
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin(app, 'ADMIN');

      const res = await app.inject({
        method: 'DELETE',
        url: '/products/00000000-0000-0000-0000-000000000000/image',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});

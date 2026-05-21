import { Test, type TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
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

  it('/auth/register (POST) - success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'E2E User',
        email: `e2e-${Date.now()}@example.com`,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
  });

  it('/auth/register (POST) - duplicate email', async () => {
    const email = `e2e-dup-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'First', email, password: 'password123' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Second', email, password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('/auth/register (POST) - validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: '', email: 'invalid', password: '12' },
    });

    expect(res.statusCode).toBe(400);
  });
});

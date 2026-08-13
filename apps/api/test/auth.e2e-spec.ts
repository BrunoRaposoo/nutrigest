import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

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
    app.useGlobalFilters(new AllExceptionsFilter());
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

  it('/auth/register (POST) - ignores role escalation attempt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Escalation Attempt',
        email: `e2e-escalation-${Date.now()}@example.com`,
        password: 'password123',
        role: 'ADMIN',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.role).toBe('OPERATOR');
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

  it('/auth/login (POST) - success', async () => {
    const email = `e2e-login-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Login E2E', email, password: 'password123' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user.email).toBe(email);
  });

  it('/auth/login (POST) - wrong password', async () => {
    const email = `e2e-login-wrong-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Wrong PW', email, password: 'password123' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('/auth/refresh (POST) - success', async () => {
    const email = `e2e-refresh-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Refresh E2E', email, password: 'password123' },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });
    const loginBody = JSON.parse(loginRes.body);

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: loginBody.refreshToken },
    });

    expect(refreshRes.statusCode).toBe(201);
    const refreshBody = JSON.parse(refreshRes.body);
    expect(refreshBody).toHaveProperty('accessToken');
    expect(refreshBody).toHaveProperty('refreshToken');
    expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);
  });

  it('/auth/refresh (POST) - reject invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('/auth/register (POST) - validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: '', email: 'invalid', password: '12' },
    });

    expect(res.statusCode).toBe(400);
  });

  describe('/auth/forgot-password (POST)', () => {
    it('should return reset token for existing user', async () => {
      const email = `e2e-forgot-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Forgot E2E', email, password: 'password123' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('resetToken');
    });

    it('should return generic message for non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'nonexistent@example.com' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('message');
      expect(body).not.toHaveProperty('resetToken');
    });

    it('should not expose resetToken when NODE_ENV is production', async () => {
      const email = `e2e-forgot-prod-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Forgot Prod E2E', email, password: 'password123' },
      });

      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/auth/forgot-password',
          payload: { email },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('message');
        expect(body).not.toHaveProperty('resetToken');
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    });

    it('should return 429 JSON when the per-route limit is exceeded', async () => {
      const email = `e2e-forgot-throttled-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Forgot Throttled E2E',
          email,
          password: 'password123',
        },
      });

      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const statusCodes: number[] = [];
        let first429Body: Record<string, unknown> | null = null;
        let retryAfter: string | undefined;

        for (let i = 0; i < 8; i++) {
          const res = await app.inject({
            method: 'POST',
            url: '/auth/forgot-password',
            payload: { email },
          });
          statusCodes.push(res.statusCode);
          if (res.statusCode === 429) {
            first429Body = JSON.parse(res.body);
            retryAfter = res.headers['retry-after'];
            break;
          }
        }

        expect(statusCodes).toContain(429);
        expect(first429Body).not.toBeNull();
        expect(first429Body?.statusCode).toBe(429);
        expect(retryAfter).toBeDefined();
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    });
  });

  describe('/auth/reset-password (POST)', () => {
    it('should reset password with valid token', async () => {
      const email = `e2e-reset-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Reset E2E', email, password: 'password123' },
      });

      const forgotRes = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email },
      });
      const { resetToken } = JSON.parse(forgotRes.body);

      const resetRes = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { email, token: resetToken, password: 'newpassword456' },
      });

      expect(resetRes.statusCode).toBe(201);
      const resetBody = JSON.parse(resetRes.body);
      expect(resetBody).toHaveProperty('message');

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'newpassword456' },
      });

      expect(loginRes.statusCode).toBe(201);
    });

    it('should reject invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: {
          email: 'nobody@example.com',
          token: 'invalid-token',
          password: 'newpassword456',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject a token bound to a different email', async () => {
      const email = `e2e-reset-other-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Reset Other E2E', email, password: 'password123' },
      });

      const forgotRes = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email },
      });
      const { resetToken } = JSON.parse(forgotRes.body);

      const resetRes = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: {
          email: 'someone-else@example.com',
          token: resetToken,
          password: 'newpassword456',
        },
      });

      expect(resetRes.statusCode).toBe(400);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      expect(loginRes.statusCode).toBe(201);
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should reject without token (unauthorized)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should revoke refresh tokens', async () => {
      const email = `e2e-logout-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Logout E2E', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const loginBody = JSON.parse(loginRes.body);

      const logoutRes = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${loginBody.accessToken}` },
      });

      expect(logoutRes.statusCode).toBe(201);

      const refreshRes = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: loginBody.refreshToken },
      });

      expect(refreshRes.statusCode).toBe(401);
    });
  });

  describe('/auth/me (GET) - profile', () => {
    it('should reject without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return current user profile', async () => {
      const email = `e2e-me-get-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Me Get', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const { accessToken } = JSON.parse(loginRes.body);

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('id');
      expect(body.email).toBe(email);
      expect(body).toHaveProperty('role');
      expect(body).not.toHaveProperty('passwordHash');
    });
  });

  describe('/auth/me (PATCH) - update profile', () => {
    it('should reject without token', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should update user name', async () => {
      const email = `e2e-me-patch-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Old Name', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const { accessToken } = JSON.parse(loginRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('New Name');
    });

    it('should update password and allow login with new password', async () => {
      const email = `e2e-me-pw-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Me PW', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const { accessToken } = JSON.parse(loginRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          password: 'newpassword456',
          currentPassword: 'password123',
        },
      });

      expect(res.statusCode).toBe(200);

      const newLoginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'newpassword456' },
      });

      expect(newLoginRes.statusCode).toBe(201);

      const oldLoginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });

      expect(oldLoginRes.statusCode).toBe(401);
    });

    it('should reject password change without currentPassword', async () => {
      const email = `e2e-me-pw-missing-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Me PW Missing', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const { accessToken } = JSON.parse(loginRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { password: 'newpassword456' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject password change with wrong currentPassword', async () => {
      const email = `e2e-me-pw-wrong-${Date.now()}@example.com`;

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Me PW Wrong', email, password: 'password123' },
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });
      const { accessToken } = JSON.parse(loginRes.body);

      const res = await app.inject({
        method: 'PATCH',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          password: 'newpassword456',
          currentPassword: 'wrongpassword',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

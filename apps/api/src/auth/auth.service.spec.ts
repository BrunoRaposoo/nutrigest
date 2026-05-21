import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [AuthService, DbService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  it('should register a new user', async () => {
    const result = await service.register({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      role: 'OPERATOR',
    });

    expect(result).toHaveProperty('id');
    expect(result.email).toContain('test-');
    expect(result.role).toBe('OPERATOR');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should reject duplicate email', async () => {
    const email = `dup-${Date.now()}@example.com`;

    await service.register({
      name: 'First',
      email,
      password: 'password123',
    });

    await expect(
      service.register({
        name: 'Second',
        email,
        password: 'password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should login with valid credentials', async () => {
    const email = `login-valid-${Date.now()}@example.com`;

    await service.register({
      name: 'Login Test',
      email,
      password: 'password123',
    });

    const result = await service.login({ email, password: 'password123' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe(email);
  });

  it('should reject invalid password', async () => {
    const email = `login-invalid-${Date.now()}@example.com`;

    await service.register({
      name: 'Login Test',
      email,
      password: 'password123',
    });

    await expect(
      service.login({ email, password: 'wrongpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject non-existent email', async () => {
    await expect(
      service.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should refresh tokens successfully', async () => {
    const email = `refresh-${Date.now()}@example.com`;

    await service.register({
      name: 'Refresh Test',
      email,
      password: 'password123',
    });

    const loginResult = await service.login({ email, password: 'password123' });

    const refreshResult = await service.refresh({
      refreshToken: loginResult.refreshToken,
    });

    expect(refreshResult).toHaveProperty('accessToken');
    expect(refreshResult).toHaveProperty('refreshToken');
    expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);
    expect(refreshResult.user.email).toBe(email);
  });

  it('should reject already-used refresh token (reuse detection)', async () => {
    const email = `reuse-${Date.now()}@example.com`;

    await service.register({
      name: 'Reuse Test',
      email,
      password: 'password123',
    });

    const loginResult = await service.login({ email, password: 'password123' });

    await service.refresh({ refreshToken: loginResult.refreshToken });

    await expect(
      service.refresh({ refreshToken: loginResult.refreshToken }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject invalid refresh token', async () => {
    await expect(
      service.refresh({ refreshToken: 'invalid-token-value' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

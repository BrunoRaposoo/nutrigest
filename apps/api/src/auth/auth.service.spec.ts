import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { passwordResetTokens, refreshTokens } from '../db/schema';
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

  afterEach(async () => {
    await db.db.delete(refreshTokens);
    await db.db.delete(passwordResetTokens);
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  it('should register a new user', async () => {
    const result = await service.register({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
    });

    expect(result).toHaveProperty('id');
    expect(result.email).toContain('test-');
    expect(result.role).toBe('OPERATOR');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should always register users with OPERATOR role', async () => {
    const result = await service.register({
      name: 'Role Escalation',
      email: `role-${Date.now()}@example.com`,
      password: 'password123',
    });

    expect(result.role).toBe('OPERATOR');
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

  describe('updateProfile', () => {
    async function createUser() {
      const email = `profile-${Date.now()}-${Math.random()}@example.com`;
      return service.register({
        name: 'Profile Test',
        email,
        password: 'password123',
      });
    }

    it('should update name without password', async () => {
      const user = await createUser();

      const result = await service.updateProfile(user.id, { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should change password when currentPassword is correct', async () => {
      const user = await createUser();

      const result = await service.updateProfile(user.id, {
        password: 'newpassword456',
        currentPassword: 'password123',
      });

      expect(result).toHaveProperty('id');

      const loginResult = await service.login({
        email: user.email,
        password: 'newpassword456',
      });
      expect(loginResult).toHaveProperty('accessToken');
    });

    it('should reject changing password without currentPassword', async () => {
      const user = await createUser();

      await expect(
        service.updateProfile(user.id, { password: 'newpassword456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject changing password with wrong currentPassword', async () => {
      const user = await createUser();

      await expect(
        service.updateProfile(user.id, {
          password: 'newpassword456',
          currentPassword: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a new password equal to the current password', async () => {
      const user = await createUser();

      await expect(
        service.updateProfile(user.id, {
          password: 'password123',
          currentPassword: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for existing user', async () => {
      const email = `forgot-${Date.now()}@example.com`;

      await service.register({
        name: 'Forgot Test',
        email,
        password: 'password123',
      });

      const result = await service.forgotPassword({ email });

      expect(result).toHaveProperty('resetToken');
      expect(typeof result.resetToken).toBe('string');
      expect(result.resetToken.length).toBeGreaterThan(0);
    });

    it('should return generic message for non-existent email', async () => {
      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('resetToken');
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens', async () => {
      const email = `logout-${Date.now()}@example.com`;

      await service.register({
        name: 'Logout Test',
        email,
        password: 'password123',
      });

      const loginResult = await service.login({
        email,
        password: 'password123',
      });

      await service.logout(loginResult.user.id);

      await expect(
        service.refresh({ refreshToken: loginResult.refreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login (destructive)', () => {
    it('should invalidate previous refresh tokens on new login', async () => {
      const email = `login-destructive-${Date.now()}@example.com`;

      await service.register({
        name: 'Login Destructive',
        email,
        password: 'password123',
      });

      const firstLogin = await service.login({
        email,
        password: 'password123',
      });

      const secondLogin = await service.login({
        email,
        password: 'password123',
      });

      expect(secondLogin.refreshToken).not.toBe(firstLogin.refreshToken);

      await expect(
        service.refresh({ refreshToken: firstLogin.refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      const thirdLogin = await service.refresh({
        refreshToken: secondLogin.refreshToken,
      });
      expect(thirdLogin).toHaveProperty('accessToken');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const email = `reset-${Date.now()}@example.com`;

      await service.register({
        name: 'Reset Test',
        email,
        password: 'password123',
      });

      const { resetToken } = (await service.forgotPassword({ email })) as {
        resetToken: string;
      };

      const result = await service.resetPassword({
        email,
        token: resetToken,
        password: 'newpassword456',
      });

      expect(result).toHaveProperty('message');

      const loginResult = await service.login({
        email,
        password: 'newpassword456',
      });

      expect(loginResult).toHaveProperty('accessToken');
    });

    it('should reject invalid token', async () => {
      await expect(
        service.resetPassword({
          email: 'nonexistent@example.com',
          token: 'invalid-token',
          password: 'newpassword456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject already used token', async () => {
      const email = `reset-used-${Date.now()}@example.com`;

      await service.register({
        name: 'Reset Used',
        email,
        password: 'password123',
      });

      const { resetToken } = (await service.forgotPassword({ email })) as {
        resetToken: string;
      };

      await service.resetPassword({
        email,
        token: resetToken,
        password: 'newpassword456',
      });

      await expect(
        service.resetPassword({
          email,
          token: resetToken,
          password: 'anotherpassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a valid token bound to a different email', async () => {
      const email = `reset-other-${Date.now()}@example.com`;

      await service.register({
        name: 'Reset Other',
        email,
        password: 'password123',
      });

      const { resetToken } = (await service.forgotPassword({ email })) as {
        resetToken: string;
      };

      await expect(
        service.resetPassword({
          email: 'someone-else@example.com',
          token: resetToken,
          password: 'newpassword456',
        }),
      ).rejects.toThrow(BadRequestException);

      const loginResult = await service.login({
        email,
        password: 'password123',
      });
      expect(loginResult).toHaveProperty('accessToken');
    });

    it('should not expose resetToken in production', async () => {
      const email = `reset-prod-${Date.now()}@example.com`;

      await service.register({
        name: 'Reset Prod',
        email,
        password: 'password123',
      });

      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const result = await service.forgotPassword({ email });
        expect(result).not.toHaveProperty('resetToken');
        expect(result).toHaveProperty('message');
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    });
  });
});

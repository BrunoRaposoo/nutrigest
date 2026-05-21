import { Test, type TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DbService } from '../db/db.service';
import { ConflictException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
});

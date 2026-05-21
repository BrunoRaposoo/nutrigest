# Auth + Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete authentication (register, login, refresh token, password recovery) and user CRUD with role-based access control.

**Architecture:** Modular NestJS with `AuthModule` and `UsersModule`. Drizzle ORM for PostgreSQL. JWT with refresh token rotation. bcrypt for password hashing. Swagger for API documentation.

**Tech Stack:** NestJS + Fastify, Drizzle ORM, PostgreSQL, JWT (passport), bcrypt, Swagger

---

### Task 1: Register

**Context:** First auth sub-feature. Creates the User schema, DTO, service method, and controller endpoint. Seed with admin user.

**Files:**
- Create: `apps/api/src/db/schema/users.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/src/db/seed.ts`
- Create: `apps/api/src/auth/dto/register.dto.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Create User schema**

Write `apps/api/src/db/schema/users.ts`:
```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'TECHNICIAN', 'OPERATOR']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('OPERATOR'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Update `apps/api/src/db/schema/index.ts`:
```typescript
export * from './users';
```

- [ ] **Step 2: Generate and apply migration**

Run: `pnpm --filter @nutrigest/api exec drizzle-kit generate`
Run: `pnpm --filter @nutrigest/api exec drizzle-kit migrate`

- [ ] **Step 3: Create Register DTO**

Write `apps/api/src/auth/dto/register.dto.ts` with Zod validation:
```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'OPERATOR']).optional().default('OPERATOR'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
```

- [ ] **Step 4: Install nestjs-zod for DTO validation**

Run: `pnpm --filter @nutrigest/api add nestjs-zod`

- [ ] **Step 5: Create AuthService with register method**

Write `apps/api/src/auth/auth.service.ts`:
```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private db: DbService) {}

  async register(dto: RegisterDto) {
    const existing = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const [user] = await this.db.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    return user;
  }
}
```

- [ ] **Step 6: Create AuthController with register endpoint**

Write `apps/api/src/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User created successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
```

- [ ] **Step 7: Create AuthModule**

Write `apps/api/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 8: Register AuthModule in AppModule**

Update `apps/api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DbModule, AuthModule],
})
export class AppModule {}
```

- [ ] **Step 9: Write unit tests for AuthService.register**

Write `apps/api/src/auth/auth.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
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
```

- [ ] **Step 10: Write e2e tests for register**

Write `apps/api/test/auth.e2e-spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
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
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/register (POST) - success', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'E2E User',
        email: `e2e-${Date.now()}@example.com`,
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('id');
    expect(body.email).toContain('e2e-');
  });

  it('/auth/register (POST) - duplicate email', async () => {
    const email = `e2e-dup-${Date.now()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'First', email, password: 'password123' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Second', email, password: 'password123' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('/auth/register (POST) - validation error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: '', email: 'invalid', password: '12' },
    });

    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 11: Run tests**

Run: `pnpm --filter @nutrigest/api test`

- [ ] **Step 12: Create seed file**

Write `apps/api/src/db/seed.ts`:
```typescript
import { DbService } from './db.service';
import { users } from './schema';
import * as bcrypt from 'bcrypt';

export async function seedDatabase(db: DbService) {
  const existing = await db.db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@nutrigest.com'))
    .limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await db.db.insert(users).values({
      name: 'Admin',
      email: 'admin@nutrigest.com',
      passwordHash,
      role: 'ADMIN',
    });
  }
}
```

Add seed script to `apps/api/package.json`:
```json
"seed": "ts-node src/db/seed.ts"
```

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "feat: add user registration with auth module"
```

---

### Task 2: Login

**Context:** Adds JWT authentication with passport. Login endpoint returns access token + refresh token + user data.

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Install JWT deps**

Run: `pnpm --filter @nutrigest/api add @nestjs/jwt @nestjs/passport passport passport-jwt && pnpm --filter @nutrigest/api add -D @types/passport-jwt`

- [ ] **Step 2: Create Login DTO**

Write `apps/api/src/auth/dto/login.dto.ts`:
```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class LoginDto extends createZodDto(LoginSchema) {}
```

- [ ] **Step 3: Create JwtStrategy**

Write `apps/api/src/auth/strategies/jwt.strategy.ts`:
(Strategy that validates JWT from Bearer header)

- [ ] **Step 4: Create JwtAuthGuard**

Write `apps/api/src/auth/guards/jwt-auth.guard.ts`

- [ ] **Step 5: Add login method to AuthService**

Add `login()` method that validates credentials and returns JWT pair.

- [ ] **Step 6: Add login endpoint to AuthController**

`POST /auth/login` returning `{ accessToken, refreshToken, user }`

- [ ] **Step 7: Update AuthModule**

Register JwtStrategy, JwtModule, PassportModule.

- [ ] **Step 8: Update tests**

Add login tests to unit and e2e.

- [ ] **Step 9: Run tests and commit**

---

### Task 3: Refresh Token

**Context:** Adds RefreshToken table and refresh endpoint. Token rotation with reuse detection.

**Files:**
- Create: `apps/api/src/db/schema/refresh-tokens.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/dto/refresh.dto.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

---

### Task 4: Password Recovery

**Context:** Forgot and reset password flow with token stored in DB.

**Files:**
- Create: `apps/api/src/db/schema/password-reset-tokens.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/dto/forgot-password.dto.ts`
- Create: `apps/api/src/auth/dto/reset-password.dto.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

---

### Task 5: User CRUD (Admin)

**Context:** Admin-only CRUD endpoints for managing users.

**Files:**
- Create: `apps/api/src/users/users.module.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/dto/create-user.dto.ts`
- Create: `apps/api/src/users/dto/update-user.dto.ts`
- Create: `apps/api/src/common/decorators/roles.decorator.ts`
- Create: `apps/api/src/auth/guards/roles.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/users/users.service.spec.ts`
- Test: `apps/api/test/users.e2e-spec.ts`

---

### Task 6: Profile (/me)

**Context:** Authenticated user can view and update own profile.

**Files:**
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

---

## Overall Success Criteria

1. `pnpm lint` — Biome clean
2. `pnpm --filter @nutrigest/api test` — All tests passing
3. `pnpm --filter @nutrigest/api build` — Compiles without errors
4. `pnpm --filter @nutrigest/api exec drizzle-kit generate` — Migrations generate cleanly
5. API starts and Swagger is accessible at `/api` or `/docs`

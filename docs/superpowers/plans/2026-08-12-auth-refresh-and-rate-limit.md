# Auth: Refresh O(1), Silent Refresh, Rate Limit + Helmet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate O(n) bcrypt token lookups on auth, add silent refresh to the web client, and add rate limiting + security headers.

**Architecture:** Replace bcrypt-compare-over-all-rows with an indexed `sha256` digest lookup (O(1)) for refresh and password-reset tokens; bind email to password reset; add `@nestjs/throttler` (Fastify-compatible) with per-route limits that skip in `test` env, plus `@fastify/helmet`; add a single-flight silent-refresh interceptor with a pending queue to `apps/web/src/lib/api.ts`.

**Tech Stack:** NestJS 11 + Fastify (custom `NutrigestFastifyAdapter`), Drizzle ORM + PostgreSQL, `@nestjs/throttler@^6.5.0` (peer supports Nest 11), `@fastify/helmet@^13.0.2`, Axios (web), Vitest + jsdom (web tests).

**Spec:** `docs/superpowers/specs/2026-08-12-auth-refresh-and-rate-limit-design.md`
**Branch:** `fix/auth-refresh-and-rate-limit` (already created; contains only the spec commit `2311655`)

---

## Environment Notes

- Test DB connection (jest): `apps/api/.env.test` → `DATABASE_URL=postgresql://nutrigest:nutrigest@localhost:5434/nutrigest_test` (loaded by `apps/api/test/setup.ts` via `dotenv`).
- Dev DB: `DATABASE_URL` in `apps/api/.env` (port 5434). Docker must be up.
- Migrations: generate with `pnpm --filter @nutrigest/api exec drizzle-kit generate` (writes to `apps/api/drizzle/`), apply to dev DB with `pnpm --filter @nutrigest/api exec drizzle-kit migrate`, and to the test DB with `DATABASE_URL=postgresql://nutrigest:nutrigest@localhost:5434/nutrigest_test pnpm --filter @nutrigest/api exec drizzle-kit migrate`.
- Jest sets `process.env.NODE_ENV = 'test'` automatically. The throttler guard skips when `NODE_ENV === 'test'`, so existing suites (which hammer `/auth/*`) keep passing. The dedicated 429 e2e uses a guard that does **not** skip.
- Root scripts: `pnpm lint` (biome), `pnpm build:api`, `pnpm build:web`, `pnpm --filter @nutrigest/api test`, `pnpm --filter @nutrigest/api test:e2e`, `pnpm --filter @nutrigest/web test`.
- Fastify IP detection: Fastify may not populate `req.ips` unless trust-proxy is configured — always guard `req.ips` with `Array.isArray(...)` before reading `[0]`.

---

### Task 1: O(1) token digest lookup + email-bound password reset (schema, migration, service, DTO, unit tests)

**Files:**
- Modify: `apps/api/src/db/schema/refresh-tokens.ts`
- Modify: `apps/api/src/db/schema/password-reset-tokens.ts`
- Create: `apps/api/drizzle/0010_*.sql` (generated, then edited — see below)
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/dto/reset-password.dto.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

This task must ship schema + service + DTO together because after dropping `token_hash` the old service no longer compiles (type from Drizzle loses the column). Every commit stays green.

- [ ] **Step 1: Rewrite the token schemas with `tokenDigest` (unique index)**

Replace the full contents of `apps/api/src/db/schema/refresh-tokens.ts`:

```ts
import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenDigest: varchar('token_digest', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_digest_unique').on(table.tokenDigest),
  ],
);
```

Replace the full contents of `apps/api/src/db/schema/password-reset-tokens.ts`:

```ts
import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenDigest: varchar('token_digest', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_token_digest_unique').on(
      table.tokenDigest,
    ),
  ],
);
```

- [ ] **Step 2: Generate and hand-edit the migration**

Run: `pnpm --filter @nutrigest/api exec drizzle-kit generate`

Expected: `apps/api/drizzle/0010_*.sql` created with `DROP COLUMN "token_hash"`, `ADD COLUMN "token_digest" varchar(64) NOT NULL`, and two `CREATE UNIQUE INDEX` statements.

Edit the generated file: immediately after the leading Drizzle comment block, prepend the two DELETE statements so the NOT NULL column add succeeds on tables that already have rows:

```sql
DELETE FROM "refresh_tokens";
DELETE FROM "password_reset_tokens";
```

The file body must then be (keep drizzle's generated naming for `.sql`):

```sql
DELETE FROM "refresh_tokens";
DELETE FROM "password_reset_tokens";

ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "token_hash";
ALTER TABLE "password_reset_tokens" DROP COLUMN IF EXISTS "token_hash";
ALTER TABLE "refresh_tokens" ADD COLUMN "token_digest" varchar(64) NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN "token_digest" varchar(64) NOT NULL;
CREATE UNIQUE INDEX "refresh_tokens_token_digest_unique" ON "refresh_tokens" USING btree ("token_digest");
CREATE UNIQUE INDEX "password_reset_tokens_token_digest_unique" ON "password_reset_tokens" USING btree ("token_digest");
```

(If drizzle-kit generated identical statements — adjust to match, keeping the two DELETEs and the four ALTERs + two indexes.)

- [ ] **Step 3: Apply the migration to both databases**

```bash
pnpm --filter @nutrigest/api exec drizzle-kit migrate
DATABASE_URL=postgresql://nutrigest:nutrigest@localhost:5434/nutrigest_test pnpm --filter @nutrigest/api exec drizzle-kit migrate
```

Expected: both print `applied 1 migration`.

- [ ] **Step 4: Update the reset-password DTO to require `email`**

Replace the full contents of `apps/api/src/auth/dto/reset-password.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  email: z.string().email().max(255),
  token: z.string().min(1),
  password: z.string().min(6).max(100),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;
```

- [ ] **Step 5: Update unit tests to the new contract and add the email-bound/neutral cases**

In `apps/api/src/auth/auth.service.spec.ts`:

1. Update the import line 9 to also import `passwordResetTokens`:

```ts
import { passwordResetTokens, refreshTokens } from '../db/schema';
```

2. Update `afterEach` (line 27-29) to wipe both tables:

```ts
  afterEach(async () => {
    await db.db.delete(refreshTokens);
    await db.db.delete(passwordResetTokens);
  });
```

3. Add these tests inside the existing `describe('resetPassword', ...)` block (after the existing three tests), and update the three existing `resetPassword` calls to include `email`:

Existing `should reset password with valid token` (line 253-260) becomes:

```ts
      const { resetToken } = (await service.forgotPassword({ email })) as {
        resetToken: string;
      };

      const result = await service.resetPassword({
        email,
        token: resetToken,
        password: 'newpassword456',
      });
```

Existing `should reject invalid token` (line 272-279) becomes:

```ts
    it('should reject invalid token', async () => {
      await expect(
        service.resetPassword({
          email: 'nonexistent@example.com',
          token: 'invalid-token',
          password: 'newpassword456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
```

Existing `should reject already used token` (line 294-304) becomes:

```ts
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
```

4. Add three new tests at the end of `describe('resetPassword', ...)`:

```ts
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
```

- [ ] **Step 6: Run tests to verify they fail on the old service (red phase)**

Run: `pnpm --filter @nutrigest/api test -- auth.service.spec.ts`

Expected: FAIL (compilation: `AuthService` still references `tokenHash`, which no longer exists on the schemas).

- [ ] **Step 7: Implement the O(1) service**

In `apps/api/src/auth/auth.service.ts`:

1. Update the import on line 1 to add `createHash`:

```ts
import { createHash, randomBytes } from 'node:crypto';
```

2. Keep the existing imports (`and, eq, gt, isNull` from `drizzle-orm` are all used). Add a module-level helper after the imports:

```ts
function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
```

3. Replace the body of `forgotPassword` (lines 193-216):

```ts
  async forgotPassword(dto: ForgotPasswordData) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      return {
        message: 'If that email exists, a reset token has been generated',
      };
    }

    await this.db.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    const rawToken = randomBytes(48).toString('hex');
    const tokenDigest = sha256(rawToken);

    await this.db.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenDigest,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    if (process.env.NODE_ENV === 'production') {
      return {
        message: 'If that email exists, a reset token has been generated',
      };
    }

    return { resetToken: rawToken };
  }
```

4. Replace the body of `resetPassword` (lines 218-256):

```ts
  async resetPassword(dto: ResetPasswordData) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const [stored] = await this.db.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenDigest, sha256(dto.token)),
          eq(passwordResetTokens.userId, user.id),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.db.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    await this.db.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, stored.id));

    return { message: 'Password updated successfully' };
  }
```

5. Replace the body of `refresh` (lines 258-303):

```ts
  async refresh(dto: RefreshData) {
    const [matchedToken] = await this.db.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenDigest, sha256(dto.refreshToken)),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.db.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, matchedToken.id));

    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, matchedToken.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
```

6. In `generateTokens` (lines 174-191), replace the hash+insert portion:

```ts
    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTokenDigest = sha256(rawRefreshToken);

    await this.db.db.insert(refreshTokens).values({
      userId,
      tokenDigest: refreshTokenDigest,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: rawRefreshToken };
```

7. Remove the now-unused `* as bcrypt` import ONLY if nothing else uses bcrypt in this file. It is still used by `register` (line 38), `login` (line 70), and `updateProfile` (line 151) — **keep the import**.

- [ ] **Step 8: Run the unit suite**

Run: `pnpm --filter @nutrigest/api test -- auth.service.spec.ts`

Expected: PASS — all `AuthService` tests including the three new ones.

- [ ] **Step 9: Run the full api suite (regression on other specs)**

Run: `pnpm --filter @nutrigest/api test`

Expected: PASS — count increases by ~3 (the new reset/reset-prod/email-mismatch cases added in Step 5). Other specs touch `refresh_tokens` indirectly via login flows and must stay green.

- [ ] **Step 10: Lint**

Run: `pnpm lint`

Expected: no errors. If biome reformats, run `pnpm format` then re-run `pnpm lint`.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/db/schema/refresh-tokens.ts apps/api/src/db/schema/password-reset-tokens.ts apps/api/drizzle/ apps/api/src/auth/auth.service.ts apps/api/src/auth/dto/reset-password.dto.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "fix: O(1) token lookup with sha256 digest and email-bound password reset"
```

---

### Task 2: Update auth e2e for email-bound reset + production-neutral forgot

**Files:**
- Modify: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Add the `email` field to reset-password e2e payloads**

In `apps/api/test/auth.e2e-spec.ts`, in `describe('/auth/reset-password (POST)')`:

Existing `should reset password with valid token` (line 221-225) — add `email`:

```ts
      const resetRes = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { email, token: resetToken, password: 'newpassword456' },
      });
```

Existing `should reject invalid token` (line 240-248) — add a plausible `email`:

```ts
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
```

- [ ] **Step 2: Add e2e for email mismatch + production-neutral forgot**

Add inside `describe('/auth/reset-password (POST)')`:

```ts
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
```

Add inside `describe('/auth/forgot-password (POST)')`:

```ts
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
```

- [ ] **Step 3: Run the auth e2e**

Run: `pnpm --filter @nutrigest/api test:e2e -- auth.e2e-spec.ts`

Expected: PASS — all auth e2e suites.

- [ ] **Step 4: Lint**

Run: `pnpm lint`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/auth.e2e-spec.ts
git commit -m "test: bind email to password reset in e2e and cover production-neutral forgot"
```

---

### Task 3: Rate limiting with @nestjs/throttler (+ 429 e2e)

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/auth/app-throttler.guard.ts`
- Create: `apps/api/src/auth/throttler.config.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/test/throttle.e2e-spec.ts`

- [ ] **Step 1: Install the dependency**

```bash
pnpm --filter @nutrigest/api add @nestjs/throttler@^6.5.0
```

Expected: `@nestjs/throttler` added to `apps/api/package.json` dependencies.

- [ ] **Step 2: Write the 429 e2e (self-contained guard)**

This spec is self-contained: it wires its own `ThrottlerModule` + a non-skipping guard, so it verifies the 429 semantics directly and passes immediately. It is a regression guard proving throttling works with the Fastify adapter IP detection (`req.ips` guard) — separate from the production `AppThrottlerGuard`, which intentionally skips in `NODE_ENV=test`.

Create `apps/api/test/throttle.e2e-spec.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

class TestThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const ips = req.ips;
    const tracker = Array.isArray(ips) && ips.length > 0 ? ips[0] : req.ip;
    return Promise.resolve(tracker);
  }
}

describe('Rate limiting (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 3 }],
        }),
      ],
      controllers: [PingController],
      providers: [{ provide: APP_GUARD, useClass: TestThrottlerGuard }],
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

  it('should return 200 for requests within the limit and 429 beyond it', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: '/ping' });
      expect(res.statusCode).toBe(200);
    }

    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(429);
  });
});
```

- [ ] **Step 3: Run the 429 e2e to verify the guard wiring**

Run: `pnpm --filter @nutrigest/api test:e2e -- throttle.e2e-spec.ts`

Expected: PASS — the 4th request returns 429 (self-contained guard wired in Step 2).

- [ ] **Step 4: Create the app throttler guard**

Create `apps/api/src/auth/app-throttler.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const ips = req.ips;
    const tracker = Array.isArray(ips) && ips.length > 0 ? ips[0] : req.ip;
    return Promise.resolve(tracker);
  }

  override async canActivate(
    context: Parameters<ThrottlerGuard['canActivate']>[0],
  ): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: Create the throttler config**

Create `apps/api/src/auth/throttler.config.ts`:

```ts
import type { ThrottlerOptions } from '@nestjs/throttler';

export const AUTH_THROTTLE_LIMITS = {
  login: { limit: 30, ttl: 60_000 },
  register: { limit: 10, ttl: 60_000 },
  refresh: { limit: 30, ttl: 60_000 },
  forgot: { limit: 5, ttl: 60_000 },
  reset: { limit: 5, ttl: 60_000 },
} satisfies Record<string, ThrottlerOptions>;
```

- [ ] **Step 6: Wire ThrottlerModule + guard into AuthModule**

Replace the full contents of `apps/api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { getJwtSecret } from '../config/env';
import { AppThrottlerGuard } from './app-throttler.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 7: Apply per-route `@Throttle` decorators**

In `apps/api/src/auth/auth.controller.ts`:

1. Add `@Throttle` to the imports on line 1:

```ts
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AUTH_THROTTLE_LIMITS } from './throttler.config';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
```

2. Annotate the public routes (keep the existing `@ApiOperation` lines in place):

```ts
  @Post('register')
  @Throttle({ default: AUTH_THROTTLE_LIMITS.register })
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
```

```ts
  @Post('login')
  @Throttle({ default: AUTH_THROTTLE_LIMITS.login })
  @ApiOperation({ summary: 'Authenticate user and return JWT tokens' })
  async login(@Body() dto: LoginDto) {
```

```ts
  @Post('refresh')
  @Throttle({ default: AUTH_THROTTLE_LIMITS.refresh })
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshDto) {
```

```ts
  @Post('forgot-password')
  @Throttle({ default: AUTH_THROTTLE_LIMITS.forgot })
  @ApiOperation({ summary: 'Request password reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
```

```ts
  @Post('reset-password')
  @Throttle({ default: AUTH_THROTTLE_LIMITS.reset })
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
```

- [ ] **Step 8: Run both e2e suites**

```bash
pnpm --filter @nutrigest/api test:e2e -- throttle.e2e-spec.ts
pnpm --filter @nutrigest/api test:e2e -- auth.e2e-spec.ts
```

Expected: throttle spec PASS (429 on 4th request); auth spec PASS (throttler skipped in test env).

- [ ] **Step 9: Run the full api test + e2e suites (regression)**

```bash
pnpm --filter @nutrigest/api test
pnpm --filter @nutrigest/api test:e2e
```

Expected: all PASS.

- [ ] **Step 10: Lint + commit**

```bash
pnpm lint
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/auth/app-throttler.guard.ts apps/api/src/auth/throttler.config.ts apps/api/src/auth/auth.module.ts apps/api/src/auth/auth.controller.ts apps/api/test/throttle.e2e-spec.ts
git commit -m "feat: rate limit auth endpoints with @nestjs/throttler"
```

---

### Task 4: Security headers with @fastify/helmet

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Install the dependency**

```bash
pnpm --filter @nutrigest/api add @fastify/helmet@^13.0.2
```

- [ ] **Step 2: Register helmet in bootstrap**

In `apps/api/src/main.ts`:

1. Add the import on line 5 (near the other fastify plugins):

```ts
import helmet from '@fastify/helmet';
```

2. Register the plugin right after `CORS` is enabled (after line 26):

```ts
  await app.register(helmet, { contentSecurityPolicy: false });
```

- [ ] **Step 3: Build + unit tests**

```bash
pnpm build:api
pnpm --filter @nutrigest/api test
```

Expected: build PASS; tests PASS (e2e don't run `main.ts`, so helmet doesn't affect them).

- [ ] **Step 4: Lint + commit**

```bash
pnpm lint
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/main.ts
git commit -m "feat: add security headers via @fastify/helmet"
```

---

### Task 5: Silent refresh with single-flight queue in the web client

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing web tests first**

Create `apps/web/src/lib/api.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { api } from './api';

interface MockedRoutes {
  refreshCount: number;
  refreshFail: boolean;
  protectedCalls: number;
}

function installMockAdapter(routes: MockedRoutes) {
  api.defaults.adapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    if (config.url?.includes('/auth/refresh')) {
      routes.refreshCount += 1;
      if (routes.refreshFail) {
        throw {
          config,
          response: { status: 401, data: { message: 'Invalid refresh token' } },
        };
      }
      return {
        status: 201,
        statusText: 'OK',
        headers: {},
        config,
        data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      } as AxiosResponse;
    }

    routes.protectedCalls += 1;
    if (routes.protectedCalls === 1) {
      throw {
        config,
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { ok: true },
    } as AxiosResponse;
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('silent refresh interceptor', () => {
  it('refreshes once on 401, retries the original request, and stores new tokens', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    const res = await api.get('/protected');

    expect(res.status).toBe(200);
    expect(routes.refreshCount).toBe(1);
    expect(routes.protectedCalls).toBe(2);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  it('deduplicates concurrent 401s into a single refresh call', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    const results = await Promise.all([
      api.get('/protected'),
      api.get('/protected'),
      api.get('/protected'),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(routes.refreshCount).toBe(1);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
  });

  it('clears session and redirects, and does not retry, when refresh fails', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: true,
      protectedCalls: 0,
    };
    installMockAdapter(routes);
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');

    await expect(api.get('/protected')).rejects.toBeDefined();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(routes.refreshCount).toBe(1);
  });

  it('does not attempt refresh when the original request is /auth/login', async () => {
    const routes: MockedRoutes = {
      refreshCount: 0,
      refreshFail: false,
      protectedCalls: 0,
    };
    api.defaults.adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      if (config.url?.includes('/auth/refresh')) {
        routes.refreshCount += 1;
      }
      throw {
        config,
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
    };

    await expect(api.post('/auth/login')).rejects.toBeDefined();
    expect(routes.refreshCount).toBe(0);
  });

  it('maps network errors to the server-unavailable message', async () => {
    api.defaults.adapter = async (): Promise<AxiosResponse> => {
      throw new Error('socket hang up');
    };

    await expect(api.get('/protected')).rejects.toThrow(
      'Servidor indisponível. Verifique sua conexão.',
    );
  });
});
```

(jsdom supplies `localStorage`. If a test needs `window.location.href` assignment — only the clear-session path — jsdom supports it; no stub required for the cases above.)

- [ ] **Step 2: Run web tests to verify they fail on the current interceptor**

Run: `pnpm --filter @nutrigest/web test`

Expected: FAIL — current interceptor clears tokens and redirects on any 401 (`api.test.ts`).
Also note: `window.location.href = '/login'` triggers a jsdom navigation in the current code for the failing path, which is exactly what we are replacing — after Step 3 the redirect only happens on refresh failure.

- [ ] **Step 3: Implement silent refresh**

Replace the full contents of `apps/web/src/lib/api.ts`:

```ts
import axios from 'axios';
import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let pendingQueue: Array<{
  config: RetryConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (reason?: unknown) => void;
}> = [];

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function handleUnauthorized(error: AxiosError): Promise<AxiosResponse> {
  const config = error.config as RetryConfig | undefined;

  if (!error.response) {
    return Promise.reject(
      new Error('Servidor indisponível. Verifique sua conexão.'),
    );
  }

  if (
    error.response.status !== 401 ||
    !config ||
    config._retry ||
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/refresh')
  ) {
    return Promise.reject(error);
  }

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    clearSession();
    return Promise.reject(error);
  }

  if (isRefreshing) {
    return new Promise<AxiosResponse>((resolve, reject) => {
      pendingQueue.push({ config, resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    pendingQueue.forEach(({ config: queued, resolve }) => {
      resolve(api({ ...queued, _retry: true }));
    });
    pendingQueue = [];

    return api({ ...config, _retry: true });
  } catch (refreshError) {
    pendingQueue.forEach(({ reject }) => reject(refreshError));
    pendingQueue = [];
    clearSession();
    return Promise.reject(refreshError);
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => handleUnauthorized(error),
);
```

- [ ] **Step 4: Run the web tests**

Run: `pnpm --filter @nutrigest/web test`

Expected: PASS — all five api.test.ts cases.

- [ ] **Step 5: Build web + lint**

```bash
pnpm build:web
pnpm lint
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat: silent refresh with single-flight queue on 401"
```

---

### Task 6: Full verification + master plan update

**Files:**
- Modify: `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`

- [ ] **Step 1: Run everything**

```bash
pnpm --filter @nutrigest/api test
pnpm --filter @nutrigest/api test:e2e
pnpm --filter @nutrigest/web test
pnpm lint
pnpm build:api
pnpm build:web
```

Expected: all PASS (importantly: the api unit suite stays green with its new reset cases, and the e2e total grows by 1 — the new throttle spec file).

- [ ] **Step 2: Mark Etapa 4 in the master plan**

In `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`:

1. In the `## Progresso Geral` table (line 42), change:
   `| 4 | \`fix/auth-refresh-and-rate-limit\` | Crítica 4 + Moderadas 6, 7, 8 | ⬜ pendente |`
   to `✅ concluída`.

2. In the Etapa 4 `## Passos de execução` section (lines 227-233), check off Passos 1-6 (leave **Passo 7 — Usuário testa manualmente** unchecked):

```md
- [x] **Passo 1 — TDD:** testes para refresh/reset com filtro por user/email; e2e de rate limit (429). Ver falhar.
- [x] **Passo 2 — Implementar:** eficiência do refresh/reset (filtro por usuário/e-mail); DTO com e-mail.
- [x] **Passo 3 — Implementar:** ThrottlerModule + helmet; config de limites.
- [x] **Passo 4 — Implementar:** silent refresh no interceptor (com fila de pendentes).
- [x] **Passo 5 — Verificar:** `pnpm lint`, `pnpm build:api`, `pnpm build:web`, testes API + Web.
- [x] **Passo 6 — Commit:** atômicos (`fix:` per token, `feat:` throttler, `feat:` silent refresh).
- [ ] **Passo 7 — Usuário testa manualmente (sessão > 15min sem logout); autoriza push + PR.**
```

- [ ] **Step 3: Lint docs not needed (markdown), commit**

```bash
git add docs/superpowers/plans/2026-08-11-code-quality-improvements.md
git commit -m "docs: mark Etapa 4 steps 1-6 as complete in master plan"
```

---

### Task 7: Handoff

- [ ] **Step 1: Present summary and wait for manual test**

Stop and present to the user:
- Summary of changes and commands/results run.
- Manual test script: keep a session open > 15 min without logout (silent refresh); watch Swagger for 429 after several failed logins; verify forgot-password returns a token in dev but not in production mode.
- **Do not** push/PR — user authorizes. Then push + open PR `fix/auth-refresh-and-rate-limit` → `dev` on approval.
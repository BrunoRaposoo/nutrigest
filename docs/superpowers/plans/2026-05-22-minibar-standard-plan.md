# MinibarStandard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the MinibarStandard module to define per-room minibar product configurations.

**Architecture:** New NestJS module with DTOs, service, controller following existing patterns (central-stock). Schema with unique constraint on (room, productId). CRUD endpoints for ADMIN/TECHNICIAN, read-only for OPERATOR.

**Tech Stack:** NestJS + Fastify + Drizzle ORM + PostgreSQL + Zod + Jest

---

### Task 1: Schema + DTOs + Migration

**Files:**
- Create: `apps/api/src/db/schema/minibar-standard.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/src/minibar-standard/dto/add-minibar-item.dto.ts`
- Create: `apps/api/src/minibar-standard/dto/update-minibar-item.dto.ts`

- [ ] **Step 1: Create Drizzle schema**

Write `apps/api/src/db/schema/minibar-standard.ts`:
```typescript
import { integer, pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const minibarStandard = pgTable('minibar_standard', {
  room: integer('room').notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  standardQuantity: integer('standard_quantity').notNull().default(1),
}, (table) => ({
  pk: unique('minibar_standard_room_product_pk').on(table.room, table.productId),
}));
```

- [ ] **Step 2: Export in schema index**

Add to `apps/api/src/db/schema/index.ts`:
```typescript
export * from './minibar-standard';
```

- [ ] **Step 3: Create DTOs**

`apps/api/src/minibar-standard/dto/add-minibar-item.dto.ts`:
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddMinibarItemSchema = z.object({
  productId: z.string().uuid(),
  standardQuantity: z.number().int().min(1),
});

export class AddMinibarItemDto extends createZodDto(AddMinibarItemSchema) {}

export type AddMinibarItemData = z.infer<typeof AddMinibarItemSchema>;
```

`apps/api/src/minibar-standard/dto/update-minibar-item.dto.ts`:
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMinibarItemSchema = z.object({
  standardQuantity: z.number().int().min(1),
});

export class UpdateMinibarItemDto extends createZodDto(UpdateMinibarItemSchema) {}

export type UpdateMinibarItemData = z.infer<typeof UpdateMinibarItemSchema>;
```

- [ ] **Step 4: Generate and apply migration**

Run: `pnpm --filter @nutrigest/api exec drizzle-kit generate`
Run: `pnpm --filter @nutrigest/api exec drizzle-kit migrate`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/minibar-standard.ts apps/api/src/db/schema/index.ts apps/api/src/minibar-standard/dto/
git commit -m "feat: add minibar_standard schema, DTOs and migration"
```

### Task 2: Service + Testes Unitários (TDD)

**Files:**
- Create: `apps/api/src/minibar-standard/minibar-standard.service.spec.ts`
- Create: `apps/api/src/minibar-standard/minibar-standard.service.ts`

- [ ] **Step 1: Write failing unit tests**

Write `apps/api/src/minibar-standard/minibar-standard.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { MinibarStandardService } from './minibar-standard.service';

describe('MinibarStandardService', () => {
  let service: MinibarStandardService;
  let db: DbService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MinibarStandardService, DbService],
    }).compile();

    service = module.get<MinibarStandardService>(MinibarStandardService);
    db = module.get<DbService>(DbService);
    await db.onModuleInit();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  describe('findAll', () => {
    it('should return empty array for a room with no items', async () => {
      const result = await service.findAll(101);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw for invalid room', async () => {
      await expect(service.findAll(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('add', () => {
    it('should add an item to room standard', async () => {
      const result = await service.add(101, { productId: '00000000-0000-0000-0000-000000000000', standardQuantity: 3 });
      expect(result.room).toBe(101);
      expect(result.standardQuantity).toBe(3);
    });

    it('should throw for non-existent product', async () => {
      await expect(
        service.add(101, { productId: '00000000-0000-0000-0000-000000000001', standardQuantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert when item already exists', async () => {
      const result = await service.add(101, { productId: '00000000-0000-0000-0000-000000000000', standardQuantity: 5 });
      expect(result.standardQuantity).toBe(5);
    });
  });

  describe('update', () => {
    it('should update standard quantity', async () => {
      const result = await service.update(101, '00000000-0000-0000-0000-000000000000', { standardQuantity: 10 });
      expect(result.standardQuantity).toBe(10);
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        service.update(101, '00000000-0000-0000-0000-000000000002', { standardQuantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an item from room standard', async () => {
      await expect(
        service.remove(101, '00000000-0000-0000-0000-000000000000'),
      ).resolves.toBeUndefined();
    });

    it('should throw for non-existent entry', async () => {
      await expect(
        service.remove(101, '00000000-0000-0000-0000-000000000002'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @nutrigest/api exec jest --testPathPatterns='minibar-standard'`
Expected: FAIL — "Cannot find module" (service not implemented yet)

- [ ] **Step 3: Write service implementation**

Write `apps/api/src/minibar-standard/minibar-standard.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { minibarStandard } from '../db/schema/minibar-standard';
import { products } from '../db/schema/products';
import type { AddMinibarItemData } from './dto/add-minibar-item.dto';
import type { UpdateMinibarItemData } from './dto/update-minibar-item.dto';

const VALID_ROOMS = Array.from({ length: 10 }, (_, i) => 101 + i);

@Injectable()
export class MinibarStandardService {
  constructor(private db: DbService) {}

  async findAll(room: number) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const result = await this.db.db
      .select({
        productId: minibarStandard.productId,
        productName: products.name,
        productCategory: products.category,
        productImageUrl: products.imageUrl,
        standardQuantity: minibarStandard.standardQuantity,
        createdAt: minibarStandard.createdAt,
      })
      .from(minibarStandard)
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle type resolution workaround
      .innerJoin(products as any, eq(minibarStandard.productId, products.id))
      .where(eq(minibarStandard.room, room));

    return result;
  }

  async add(room: number, dto: AddMinibarItemData) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [product] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, dto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [item] = await this.db.db
      .insert(minibarStandard)
      .values({
        room,
        productId: dto.productId,
        standardQuantity: dto.standardQuantity,
      })
      .onConflictDoUpdate({
        target: [minibarStandard.room, minibarStandard.productId],
        set: { standardQuantity: dto.standardQuantity },
      })
      .returning();

    return item;
  }

  async update(room: number, productId: string, dto: UpdateMinibarItemData) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [existing] = await this.db.db
      .select()
      .from(minibarStandard)
      .where(
        and(eq(minibarStandard.room, room), eq(minibarStandard.productId, productId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Minibar standard entry not found');
    }

    const [item] = await this.db.db
      .update(minibarStandard)
      .set({ standardQuantity: dto.standardQuantity })
      .where(
        and(eq(minibarStandard.room, room), eq(minibarStandard.productId, productId)),
      )
      .returning();

    return item;
  }

  async remove(room: number, productId: string) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const [existing] = await this.db.db
      .select()
      .from(minibarStandard)
      .where(
        and(eq(minibarStandard.room, room), eq(minibarStandard.productId, productId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Minibar standard entry not found');
    }

    await this.db.db
      .delete(minibarStandard)
      .where(
        and(eq(minibarStandard.room, room), eq(minibarStandard.productId, productId)),
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @nutrigest/api exec jest --testPathPatterns='minibar-standard'`
Expected: PASS (7+ tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/minibar-standard/minibar-standard.service.ts apps/api/src/minibar-standard/minibar-standard.service.spec.ts
git commit -m "feat: add MinibarStandardService with CRUD operations"
```

### Task 3: Controller + Module

**Files:**
- Create: `apps/api/src/minibar-standard/minibar-standard.controller.ts`
- Create: `apps/api/src/minibar-standard/minibar-standard.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create controller**

Write `apps/api/src/minibar-standard/minibar-standard.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AddMinibarItemDto } from './dto/add-minibar-item.dto';
import { UpdateMinibarItemDto } from './dto/update-minibar-item.dto';
import { MinibarStandardService } from './minibar-standard.service';

const VALID_ROOMS = Array.from({ length: 10 }, (_, i) => 101 + i);

@ApiTags('Minibar Standard')
@Controller('minibar-standard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class MinibarStandardController {
  constructor(private minibarStandardService: MinibarStandardService) {}

  @Get('rooms')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'List available room numbers (101-110)' })
  async listRooms() {
    return VALID_ROOMS;
  }

  @Get(':room')
  @Roles('ADMIN', 'TECHNICIAN', 'OPERATOR')
  @ApiOperation({ summary: 'Get minibar standard for a room' })
  async findAll(@Param('room', ParseIntPipe) room: number) {
    return this.minibarStandardService.findAll(room);
  }

  @Post(':room')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Add or replace a product in room standard (upsert)' })
  async add(
    @Param('room', ParseIntPipe) room: number,
    @Body() dto: AddMinibarItemDto,
  ) {
    return this.minibarStandardService.add(room, dto);
  }

  @Patch(':room/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update standard quantity for a product in room' })
  async update(
    @Param('room', ParseIntPipe) room: number,
    @Param('productId') productId: string,
    @Body() dto: UpdateMinibarItemDto,
  ) {
    return this.minibarStandardService.update(room, productId, dto);
  }

  @Delete(':room/:productId')
  @Roles('ADMIN', 'TECHNICIAN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a product from room standard' })
  async remove(
    @Param('room', ParseIntPipe) room: number,
    @Param('productId') productId: string,
  ) {
    await this.minibarStandardService.remove(room, productId);
  }
}
```

- [ ] **Step 2: Create module**

Write `apps/api/src/minibar-standard/minibar-standard.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { MinibarStandardController } from './minibar-standard.controller';
import { MinibarStandardService } from './minibar-standard.service';

@Module({
  controllers: [MinibarStandardController],
  providers: [MinibarStandardService],
  exports: [MinibarStandardService],
})
export class MinibarStandardModule {}
```

- [ ] **Step 3: Register in AppModule**

Add to `apps/api/src/app.module.ts`:
```typescript
import { MinibarStandardModule } from './minibar-standard/minibar-standard.module';
```
And add `MinibarStandardModule` to the `imports` array.

- [ ] **Step 4: Build check**

Run: `pnpm build:api`
Expected: Build successful

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/minibar-standard/minibar-standard.controller.ts apps/api/src/minibar-standard/minibar-standard.module.ts apps/api/src/app.module.ts
git commit -m "feat: add MinibarStandardController and Module"
```

### Task 4: Testes E2E

**Files:**
- Create: `test/minibar-standard.e2e-spec.ts`

- [ ] **Step 1: Write e2e tests**

Write `apps/api/test/minibar-standard.e2e-spec.ts`:
```typescript
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './../src/app.module';

describe('MinibarStandard (e2e)', () => {
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
    const email = `e2e-ms-${role}-${Date.now()}-${Math.random()}@example.com`;

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

  async function createProduct(accessToken: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/products',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: `MS E2E ${Date.now()}`, category: 'BEVERAGE' },
    });
    return JSON.parse(res.body);
  }

  describe('GET /minibar-standard/rooms', () => {
    it('should return list of rooms 101-110', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/rooms',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
    });
  });

  describe('GET /minibar-standard/:room', () => {
    it('should reject unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/101',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return empty array for room with no items', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
    });

    it('should return 404 for invalid room', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const res = await app.inject({
        method: 'GET',
        url: '/minibar-standard/999',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /minibar-standard/:room', () => {
    it('should add item to room standard', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.room).toBe(101);
      expect(body.standardQuantity).toBe(3);
    });

    it('should upsert when item already exists', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/102',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/102',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 5 },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).standardQuantity).toBe(5);
    });

    it('should return 404 for non-existent product', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000000',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject OPERATOR', async () => {
      const { accessToken } = await registerAndLogin('OPERATOR');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/101',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000001',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject invalid room', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'POST',
        url: '/minibar-standard/999',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          productId: '00000000-0000-0000-0000-000000000001',
          standardQuantity: 3,
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /minibar-standard/:room/:productId', () => {
    it('should update standard quantity', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/103',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 3 },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/minibar-standard/103/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { standardQuantity: 10 },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).standardQuantity).toBe(10);
    });

    it('should return 404 for non-existent entry', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'PATCH',
        url: '/minibar-standard/101/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { standardQuantity: 5 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /minibar-standard/:room/:productId', () => {
    it('should remove item from room standard', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');
      const product = await createProduct(accessToken);

      await app.inject({
        method: 'POST',
        url: '/minibar-standard/104',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { productId: product.id, standardQuantity: 2 },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/minibar-standard/104/${product.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 for non-existent entry', async () => {
      const { accessToken } = await registerAndLogin('ADMIN');

      const res = await app.inject({
        method: 'DELETE',
        url: '/minibar-standard/101/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run e2e tests (may fail until controller is ready — run after Task 3)**

Run: `pnpm --filter @nutrigest/api test:e2e`
Expected: New MinibarStandard tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/minibar-standard.e2e-spec.ts
git commit -m "test: add e2e tests for MinibarStandard module"
```

### Task 5: Final Verification + Docs

**Files:**
- Modify: `docs/AGENTS.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Full lint + build + tests**

Run: `pnpm lint`
Run: `pnpm build:api`
Run: `pnpm --filter @nutrigest/api test:e2e`
Expected: All pass

- [ ] **Step 2: Update AGENTS.md**

Add MinibarStandard endpoint table after CentralStock table.

- [ ] **Step 3: Update TODO.md**

Mark item 4 as done:
```
- [x] 4. MinibarStandard
```

- [ ] **Step 4: Commit**

```bash
git add docs/AGENTS.md docs/TODO.md
git commit -m "docs: update AGENTS.md and TODO.md with MinibarStandard"
```

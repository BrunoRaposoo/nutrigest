# StockMovement Implementation Plan

> **For agentic workers:** Use this plan to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete StockMovement module with IN, REPLENISH, MEAL_OUT operations, CentralStock integration, and list/filter endpoint.

**Architecture:** New NestJS module `StockMovementsModule` consuming `CentralStockModule`. All movement operations run in DB transactions. CentralStockService gets increment/decrement methods.

**Tech Stack:** NestJS + Fastify + Drizzle ORM + PostgreSQL + Zod + Jest

---

### Task 1: Schema + DTOs + Migration

**Files:**
- Create: `apps/api/src/db/schema/stock-movements.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/src/stock-movements/dto/create-in-movement.dto.ts`
- Create: `apps/api/src/stock-movements/dto/create-replenish-movement.dto.ts`
- Create: `apps/api/src/stock-movements/dto/create-meal-out-movement.dto.ts`
- Create: `apps/api/src/stock-movements/dto/list-movements.dto.ts`

- [ ] **Step 1: Create schema**
- [ ] **Step 2: Export in index.ts**
- [ ] **Step 3: Create 4 DTOs**
- [ ] **Step 4: Generate + apply migration**
- [ ] **Step 5: Commit**

### Task 2: CentralStockService increment/decrement (TDD)

**Files:**
- Modify: `apps/api/src/central-stock/central-stock.service.ts`
- Modify: `apps/api/src/central-stock/central-stock.service.spec.ts`

- [ ] **Step 1: Write failing tests** (6 new tests)
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement increment() and decrement()**
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**

### Task 3: StockMovementService + Unit Tests (TDD)

**Files:**
- Create: `apps/api/src/stock-movements/stock-movements.service.spec.ts`
- Create: `apps/api/src/stock-movements/stock-movements.service.ts`

- [ ] **Step 1: Write failing tests** (13 tests covering all methods)
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Implement service** (createIn, createReplenish, createMealOut, findAll)
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**

### Task 4: Controller + Module

**Files:**
- Create: `apps/api/src/stock-movements/stock-movements.controller.ts`
- Create: `apps/api/src/stock-movements/stock-movements.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create controller** (5 endpoints with Swagger)
- [ ] **Step 2: Create module** (imports CentralStockModule)
- [ ] **Step 3: Register in AppModule**
- [ ] **Step 4: Build check**
- [ ] **Step 5: Commit**

### Task 5: E2E Tests

**Files:**
- Create: `apps/api/test/stock-movements.e2e-spec.ts`

- [ ] **Step 1: Write e2e tests** (17 tests)
- [ ] **Step 2: Run e2e suite**
- [ ] **Step 3: Commit**

### Task 6: Final Verification + Docs

**Files:**
- Modify: `docs/AGENTS.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Lint + Build + Test**
- [ ] **Step 2: Update AGENTS.md** (Stock Movements endpoint table)
- [ ] **Step 3: Update TODO.md** (mark 5, 6, 7 done)
- [ ] **Step 4: Save specs and plans**
- [ ] **Step 5: Commit final**

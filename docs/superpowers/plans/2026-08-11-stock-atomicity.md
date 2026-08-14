# Integridade do estoque (atomicidade) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o padrão read-then-write não atômico no estoque central, tornando incrementos e decrementos atômicos no banco e adicionando rede de segurança via CHECK constraint.

**Architecture:** Duas primitivas atômicas: (1) incremento via `INSERT ... ON CONFLICT DO UPDATE` com `sql`${col} + delta``; (2) decremento condicional via `UPDATE ... WHERE quantity >= amount` checando linhas afetadas. As checagens de saldo de `createReplenish`/`createMealOut` movem para **dentro** da transação já existente; o banco ganha `CHECK (quantity >= 0)`.

**Tech Stack:** NestJS 11 + Fastify, Drizzle ORM (`drizzle-orm@0.43.1`, `drizzle-kit@0.30.6`), PostgreSQL 16, Jest 30, Biome 2, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-11-stock-atomicity-design.md`

**Banco:** Docker em `localhost:5434`. Dev DB: `nutrigest`. Test DB: `nutrigest_test` (`.env.test`). Docker já está de pé.

---

## Contexto de verificação

Antes de começar, confirmar que Docker e banco de teste estão prontos:

- [ ] **Step 0: Verificar Docker e test DB migrado**

Run: `docker compose ps | grep postgres`
Expected: `nutrigest-postgres ... Up`

Run: `docker compose exec -T postgres psql -U nutrigest -d nutrigest_test -c "SELECT count(*) FROM central_stock;"`
Expected: roda sem erro (tabela existe).

---

### Task 1: CHECK constraint no schema + migração

**Files:**
- Modify: `apps/api/src/db/schema/central-stock.ts`
- Create: `apps/api/drizzle/0009_*.sql` (gerada por drizzle-kit)

- [ ] **Step 1: Adicionar CHECK constraint no schema**

Alterar `apps/api/src/db/schema/central-stock.ts` para o conteúdo completo abaixo (o terceiro argumento do `pgTable` declara o CHECK):

```ts
import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const centralStock = pgTable(
  'central_stock',
  {
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [check('central_stock_quantity_nonnegative', sql`${table.quantity} >= 0`)],
);
```

- [ ] **Step 2: Gerar migração**

Run (de `apps/api/`):
`pnpm --filter @nutrigest/api exec drizzle-kit generate`
Expected: cria `apps/api/drizzle/0009_<nome>.sql` e atualiza `drizzle/meta/_journal.json`.

- [ ] **Step 3: Inspecionar a migração gerada**

Run: `cat apps/api/drizzle/0009_*.sql`
Expected: deve conter apenas o ADD CONSTRAINT do CHECK, ex.:
`ALTER TABLE "central_stock" ADD CONSTRAINT "central_stock_quantity_nonnegative" CHECK ("central_stock"."quantity" >= 0);`

Se a migração tentar recriar a tabela (DROP/ALTER de colunas), **parar** e avisar o agente principal — substituir por um `ALTER TABLE` limpo e validar o snapshot manualmente.

- [ ] **Step 4: Aplicar migração no dev e no test**

Run: `pnpm --filter @nutrigest/api exec drizzle-kit migrate`
Expected: aplica 0009 no banco `nutrigest`.

Run: `pnpm --filter @nutrigest/api db:test:setup`
Expected: aplica 0009 no banco `nutrigest_test`.

- [ ] **Step 5: Verificar a constraint nos dois bancos**

Run: `docker compose exec -T postgres psql -U nutrigest -d nutrigest -c "\d central_stock"`
Expected: aparece `Check constraints: "central_stock_quantity_nonnegative" CHECK (quantity >= 0)`.

Repetir para `nutrigest_test`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema/central-stock.ts apps/api/drizzle/
git commit -m "feat: add CHECK constraint quantity >= 0 on central_stock"
```

---

### Task 2: Incremento atômico no `upsertCentralStock`

**Files:**
- Modify: `apps/api/src/stock-movements/stock-movements.service.ts:217-234`
- Test: `apps/api/src/stock-movements/stock-movements.service.spec.ts`

- [ ] **Step 1: Escrever o teste de concorrência de `createIn` (invariante)**

Adicionar no `describe('createIn')` do spec existente. Primeiro adicionar `eq` ao import de drizzle-orm no topo do arquivo:

```ts
import { eq } from 'drizzle-orm';
```

Adicionar o teste (o arquivo já importa `products`, `users`; `getAnyProductId`/`getAnyUserId` já existem):

```ts
it('should not lose updates under concurrent IN movements', async () => {
  const productId = await getAnyProductId();
  const userId = await getAnyUserId();
  if (!productId || !userId) return;

  const before = await centralStock.getQuantity(productId);
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      service.createIn({ items: [{ productId, quantity: 1 }] }, userId),
    ),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const after = await centralStock.getQuantity(productId);

  expect(succeeded).toBe(20);
  expect(after).toBe(before + 20);
});
```

- [ ] **Step 2: Rodar o teste e documentar o comportamento atual**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: pode passar ou falhar (race é timing-dependent). Registrar o resultado como "comportamento atual documentado" — o teste é a prova de regressão que **deve** passar após o fix.

- [ ] **Step 3: Implementar o incremento atômico**

No `apps/api/src/stock-movements/stock-movements.service.ts`, adicionar `sql` ao import do drizzle-orm (linha 6):

```ts
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
```

Substituir o corpo de `upsertCentralStock` (linhas 217-234) por:

```ts
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction type
  private async upsertCentralStock(tx: any, productId: string, delta: number) {
    await tx
      .insert(centralStock)
      .values({ productId, quantity: delta })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: {
          quantity: sql`${centralStock.quantity} + ${delta}`,
          updatedAt: new Date(),
        },
      });
  }
```

- [ ] **Step 4: Rodar os testes do serviço**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: todos os testes PASS (incl. o novo teste de concorrência e os `createIn` existentes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stock-movements/stock-movements.service.ts apps/api/src/stock-movements/stock-movements.service.spec.ts
git commit -m "fix: atomic increment in upsertCentralStock"
```

---

### Task 3: Decremento condicional atômico + `createReplenish` com checagem na transação

**Files:**
- Modify: `apps/api/src/stock-movements/stock-movements.service.ts:58-123`
- Test: `apps/api/src/stock-movements/stock-movements.service.spec.ts`

- [ ] **Step 1: Escrever o teste determinístico de rollback**

Adicionar no `describe('createReplenish')` do spec existente. Adicionar import do schema no topo:

```ts
import { stockMovements } from '../db/schema/stock-movements';
```

Teste (usa dois produtos; se um item falhar, **nenhum** movimento é persistido e o estoque do item bom fica intacto):

```ts
it('should roll back all movements when any item has insufficient stock', async () => {
  const all = await db.db.select({ id: products.id }).from(products).limit(2);
  const userId = await getAnyUserId();
  if (all.length < 2 || !userId) return;

  await centralStock.update(all[0].id, { quantity: 100 });
  await centralStock.update(all[1].id, { quantity: 1 });

  const before = await db.db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.room, 105));

  await expect(
    service.createReplenish(
      105,
      {
        items: [
          { productId: all[0].id, consumedQuantity: 5, restockedQuantity: 5 },
          { productId: all[1].id, consumedQuantity: 0, restockedQuantity: 10 },
        ],
      },
      userId,
    ),
  ).rejects.toThrow(BadRequestException);

  const after = await db.db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.room, 105));

  expect(after.length).toBe(before.length);
  expect(await centralStock.getQuantity(all[0].id)).toBe(100);
});
```

- [ ] **Step 2: Rodar o teste e documentar o comportamento atual**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: o teste **passa** no código atual — a checagem de saldo roda no loop pré-transação (linhas 67-77) e falha antes de qualquer insert. Este teste é um **guard de regressão**: garante que, após o fix (checagem **dentro** da transação com rollback), o resultado observável continua o mesmo. A prova real da race é o teste de concorrência do passo seguinte.

- [ ] **Step 3: Escrever o teste de concorrência de `createReplenish` (invariante)**

Adicionar no mesmo `describe('createReplenish')`:

```ts
it('should never oversell stock under concurrent replenishes', async () => {
  const productId = await getAnyProductId();
  const userId = await getAnyUserId();
  if (!productId || !userId) return;

  const initial = 10;
  await centralStock.update(productId, { quantity: initial });

  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      service.createReplenish(
        101,
        { items: [{ productId, consumedQuantity: 0, restockedQuantity: 1 }] },
        userId,
      ),
    ),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const finalQty = await centralStock.getQuantity(productId);

  expect(succeeded).toBeLessThanOrEqual(initial);
  expect(finalQty).toBeGreaterThanOrEqual(0);
  expect(finalQty).toBe(initial - succeeded);
});
```

- [ ] **Step 4: Implementar**

Em `createReplenish` (`stock-movements.service.ts:58-123`):

1. Manter a validação de quarto e o `ensureProductExists` do loop inicial, mas **coletar nomes** num `Map` (a checagem de saldo sai desse loop). Substituir o método inteiro:

```ts
  async createReplenish(
    room: number,
    dto: CreateReplenishMovementData,
    userId: string,
  ) {
    if (!VALID_ROOMS.includes(room)) {
      throw new NotFoundException('Room not found');
    }

    const productNames = new Map<string, string>();
    for (const item of dto.items) {
      const product = await this.ensureProductExists(item.productId);
      productNames.set(item.productId, product.name);
    }

    const created = await this.db.db.transaction(async (tx) => {
      const records = [];

      for (const item of dto.items) {
        if (item.consumedQuantity > 0) {
          const [consumption] = await tx
            .insert(stockMovements)
            .values({
              type: 'CONSUMPTION',
              productId: item.productId,
              quantity: item.consumedQuantity,
              room,
              userId,
            })
            .returning();
          records.push(consumption);
        }

        if (item.restockedQuantity > 0) {
          await this.decrementCentralStock(
            tx,
            item.productId,
            item.restockedQuantity,
            productNames.get(item.productId) ?? 'produto',
          );

          const [replenish] = await tx
            .insert(stockMovements)
            .values({
              type: 'REPLENISH',
              productId: item.productId,
              quantity: item.restockedQuantity,
              room,
              userId,
            })
            .returning();

          records.push(replenish);
        }
      }

      return records;
    });

    return created;
  }
```

2. Adicionar a primitiva `decrementCentralStock` logo após `ensureProductExists` (antes de `upsertCentralStock`):

```ts
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle transaction type
  private async decrementCentralStock(
    tx: any,
    productId: string,
    amount: number,
    productName: string,
  ) {
    const [updated] = await tx
      .update(centralStock)
      .set({
        quantity: sql`${centralStock.quantity} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(centralStock.productId, productId),
          gte(centralStock.quantity, amount),
        ),
      )
      .returning({ quantity: centralStock.quantity });

    if (!updated) {
      const [current] = await tx
        .select({ quantity: centralStock.quantity })
        .from(centralStock)
        .where(eq(centralStock.productId, productId))
        .limit(1);

      throw new BadRequestException(
        `Estoque insuficiente para ${productName}: disponível ${current?.quantity ?? 0}, necessário ${amount}`,
      );
    }
  }
```

- [ ] **Step 5: Rodar os testes**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: PASS — rollback determinístico, invariante de concorrência e todos os testes existentes (incl. os que checam mensagem PT de saldo insuficiente).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/stock-movements/stock-movements.service.ts apps/api/src/stock-movements/stock-movements.service.spec.ts
git commit -m "fix: atomic conditional decrement and in-transaction stock check on replenish"
```

---

### Task 4: `createMealOut` com checagem na transação

**Files:**
- Modify: `apps/api/src/stock-movements/stock-movements.service.ts:125-153`
- Test: `apps/api/src/stock-movements/stock-movements.service.spec.ts`

- [ ] **Step 1: Escrever o teste determinístico de rollback do meal-out**

Adicionar no `describe('createMealOut')`:

```ts
it('should not create movement when stock is insufficient', async () => {
  const productId = await getAnyProductId();
  const userId = await getAnyUserId();
  if (!productId || !userId) return;

  await centralStock.update(productId, { quantity: 1 });

  const before = await db.db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.type, 'MEAL_OUT'));

  await expect(
    service.createMealOut(
      { productId, quantity: 5, description: 'test' },
      userId,
    ),
  ).rejects.toThrow(BadRequestException);

  const after = await db.db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.type, 'MEAL_OUT'));

  expect(after.length).toBe(before.length);
  expect(await centralStock.getQuantity(productId)).toBe(1);
});
```

- [ ] **Step 2: Rodar o teste e documentar o comportamento atual**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: o teste **passa** no código atual (a checagem fora da transação lança antes de criar o movimento). É um **guard de regressão** — com o fix, o comportamento é preservado mas a checagem passa a ser atômica dentro da transação. A prova real da race para meal-out é o invariante de concorrência de `decrement` na Task 5.

- [ ] **Step 3: Implementar**

Substituir `createMealOut` (`stock-movements.service.ts:125-153`) por:

```ts
  async createMealOut(dto: CreateMealOutMovementData, userId: string) {
    const product = await this.ensureProductExists(dto.productId);

    const [movement] = await this.db.db.transaction(async (tx) => {
      await this.decrementCentralStock(
        tx,
        dto.productId,
        dto.quantity,
        product.name,
      );

      const [m] = await tx
        .insert(stockMovements)
        .values({
          type: 'MEAL_OUT',
          productId: dto.productId,
          quantity: dto.quantity,
          userId,
          description: dto.description,
        })
        .returning();

      return [m];
    });

    return movement;
  }
```

- [ ] **Step 4: Rodar os testes**

Run: `pnpm --filter @nutrigest/api test -- stock-movements`
Expected: PASS — todos os testes de `createMealOut` (incl. mensagem PT e `NotFoundException`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stock-movements/stock-movements.service.ts apps/api/src/stock-movements/stock-movements.service.spec.ts
git commit -m "fix: in-transaction stock check on meal-out"
```

---

### Task 5: `CentralStockService.increment/decrement` atômicos + mensagem PT

**Files:**
- Modify: `apps/api/src/central-stock/central-stock.service.ts:106-154`
- Test: `apps/api/src/central-stock/central-stock.service.spec.ts`

- [ ] **Step 1: Escrever o teste de concorrência de `decrement` (invariante)**

Adicionar no `describe('decrement')` do spec existente. Adicionar imports no topo:

```ts
import { eq } from 'drizzle-orm';
import { products } from '../db/schema/products';
```

Teste:

```ts
it('should not oversell under concurrent decrements', async () => {
  const all = await service.findAll();
  if (all.length === 0) return;

  const initial = 10;
  await service.update(all[0].productId, { quantity: initial });

  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => service.decrement(all[0].productId, 1)),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const finalQty = await service.getQuantity(all[0].productId);

  expect(succeeded).toBeLessThanOrEqual(initial);
  expect(finalQty).toBe(initial - succeeded);
  expect(finalQty).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Rodar e documentar comportamento atual**

Run: `pnpm --filter @nutrigest/api test -- central-stock`
Expected: pode passar (timing-dependent). Documentar; é prova de regressão que deve passar após o fix.

- [ ] **Step 3: Escrever o teste de mensagem PT no `decrement`**

Adicionar no mesmo `describe('decrement')`:

```ts
it('should use Portuguese message with product name if insufficient stock', async () => {
  const all = await service.findAll();
  if (all.length === 0) return;

  await service.update(all[0].productId, { quantity: 1 });

  const [product] = await db.db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, all[0].productId))
    .limit(1);

  const error = await service
    .decrement(all[0].productId, 10)
    .catch((e: Error) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse();
  const message =
    typeof response === 'string'
      ? response
      : (response as { message: string }).message;
  expect(message).toContain('Estoque insuficiente');
  expect(message).not.toContain('Insufficient');
  if (product) expect(message).toContain(product.name);
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @nutrigest/api test -- central-stock`
Expected: o teste de mensagem PT **falha** (mensagem atual é EN `Insufficient stock: available X, required Y`).

- [ ] **Step 5: Implementar**

No `apps/api/src/central-stock/central-stock.service.ts`:

1. Trocar o import do drizzle-orm (linha 6):

```ts
import { and, eq, gte, sql } from 'drizzle-orm';
```

2. Substituir `increment` (linhas 106-126) por:

```ts
  async increment(productId: string, amount: number) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.db.db
      .insert(centralStock)
      .values({ productId, quantity: amount })
      .onConflictDoUpdate({
        target: centralStock.productId,
        set: {
          quantity: sql`${centralStock.quantity} + ${amount}`,
          updatedAt: new Date(),
        },
      });
  }
```

3. Substituir `decrement` (linhas 128-154) por:

```ts
  async decrement(productId: string, amount: number) {
    const [existing] = await this.db.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const [updated] = await this.db.db
      .update(centralStock)
      .set({
        quantity: sql`${centralStock.quantity} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(centralStock.productId, productId),
          gte(centralStock.quantity, amount),
        ),
      )
      .returning({ quantity: centralStock.quantity });

    if (!updated) {
      const available = await this.getQuantity(productId);
      throw new BadRequestException(
        `Estoque insuficiente para ${existing.name}: disponível ${available}, necessário ${amount}`,
      );
    }
  }
```

- [ ] **Step 6: Rodar os testes**

Run: `pnpm --filter @nutrigest/api test -- central-stock`
Expected: PASS — concorrência, mensagem PT, e todos os testes existentes de `increment`/`decrement`/`update`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/central-stock/central-stock.service.ts apps/api/src/central-stock/central-stock.service.spec.ts
git commit -m "fix: atomic increment/decrement with Portuguese insufficient-stock message"
```

---

### Task 6: E2E — replenish até zerar, `400` no excedente

**Files:**
- Test: `apps/api/test/stock-movements.e2e-spec.ts`

- [ ] **Step 1: Escrever o teste e2e determinístico**

Adicionar no `describe('POST /stock-movements/replenish/:room')`:

```ts
it('should return 400 when replenishing beyond available stock', async () => {
  const { accessToken } = await registerAndLogin(app, 'ADMIN');
  const product = await createProduct(accessToken);

  await app.inject({
    method: 'PATCH',
    url: `/central-stock/${product.id}`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { quantity: 3 },
  });

  for (let i = 0; i < 3; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/stock-movements/replenish/101',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        items: [{ productId: product.id, consumedQuantity: 0, restockedQuantity: 1 }],
      },
    });
    expect(res.statusCode).toBe(201);
  }

  const res = await app.inject({
    method: 'POST',
    url: '/stock-movements/replenish/101',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      items: [{ productId: product.id, consumedQuantity: 0, restockedQuantity: 1 }],
    },
  });
  expect(res.statusCode).toBe(400);
});
```

- [ ] **Step 2: Rodar o teste e documentar o comportamento atual**

Run: `pnpm --filter @nutrigest/api test:e2e -- stock-movements`
Expected: o teste **passa** no código atual (requests sequenciais: a checagem lê o estoque já commitado e o 4º replenish retorna 400). É um **guard de regressão** do comportamento determinístico; a race só se manifesta sob concorrência (coberta pelos invariantes unit).

- [ ] **Step 3: Rodar e ver passar**

Run: `pnpm --filter @nutrigest/api test:e2e -- stock-movements`
Expected: PASS — 3 chamadas retornam 201 e a 4ª retorna 400 (fix das Tasks 3-4 em vigor).

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/stock-movements.e2e-spec.ts
git commit -m "test: e2e replenish beyond available stock returns 400"
```

---

### Task 7: Verificação completa

**Files:**
- Sem alterações de código (verificação apenas).

- [ ] **Step 1: Rodar todos os testes unitários da API**

Run: `pnpm --filter @nutrigest/api test`
Expected: todos PASS (incl. `central-stock`, `stock-movements`, `products`, `dashboard` — que usam `update`).

- [ ] **Step 2: Rodar todos os testes e2e**

Run: `pnpm --filter @nutrigest/api test:e2e`
Expected: todos PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: sem erros.

- [ ] **Step 4: Build**

Run: `pnpm build:api`
Expected: build concluído sem erros.

- [ ] **Step 5: Atualizar o plano mestre**

Em `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`, marcar como `[x]` os Passos 1-6 da Etapa 3 e marcar a linha da Etapa 3 como concluída na tabela de progresso.

Commit:
```bash
git add docs/superpowers/plans/2026-08-11-code-quality-improvements.md
git commit -m "docs: mark Etapa 3 as complete in master plan"
```

---

### Task 8: Handoff para usuário

- [ ] **Step 1: Apresentar resumo e aguardar teste manual**

Após todas as tarefas passarem, parar e apresentar ao usuário:
- Resumo das mudanças e testes executados (linhas de comando + resultados).
- Pedir teste manual (ex.: pelo Swagger/UI: entrada de estoque, replenish até zerar → ver 400, meal-out excedente → ver 400).
- **Não** fazer push/PR — usuário autoriza.

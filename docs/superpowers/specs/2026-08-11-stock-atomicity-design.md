# Design — Integridade do estoque (atomicidade / race condition)

**Branch:** `fix/stock-atomicity`
**Data:** 2026-08-11
**Etapa:** 3 do plano mestre `2026-08-11-code-quality-improvements.md`

## Problema

Atualizações de estoque usam padrão **read-then-write não atômico**:

- `upsertCentralStock` (`apps/api/src/stock-movements/stock-movements.service.ts:216-232`) faz `SELECT` da quantidade e depois `INSERT ... ON CONFLICT DO UPDATE` com o valor **já calculado**. Duas requisições concorrentes podem ler a mesma quantidade e ambas gravar → **perda de atualização**.
- `createReplenish` (`stock-movements.service.ts:67-77`) verifica saldo via `getQuantity` **fora** da transação. Entre a checagem e o insert pode ocorrer outra operação → **oversell**.
- `createMealOut` (`stock-movements.service.ts:125-153`) tem o mesmo bug do `createReplenish` (checa saldo fora da transação).
- `CentralStockService.increment/decrement` (`apps/api/src/central-stock/central-stock.service.ts:106-154`) tem o mesmo padrão read-then-write não atômico.
- Não há constraint de banco impedindo `quantity < 0` persistido (o DTO do PATCH valida `min(0)`, mas o banco não).

## Decisões

1. **Abordagem 1 — operações atômicas de declaração única** (aprovada no brainstorm). Duas primitivas: incremento atômico via `INSERT ... ON CONFLICT DO UPDATE` com `sql`${col} + delta``; decremento condicional via `UPDATE ... WHERE quantity >= amount` checando rows afetadas.
2. **Incluir `createMealOut`** no escopo (mesma classe de bug do `createReplenish`).
3. **Corrigir `increment`/`decrement`** do `CentralStockService` mesmo sendo usados só em testes hoje.
4. **Adicionar CHECK constraint** `quantity >= 0` no banco como rede de segurança.
5. **Teste de concorrência:** teste de invariante real (não determinístico, aceito como regressão).

## Solução

### 1. Primitiva de incremento (atômica)

`upsertCentralStock` passa a usar uma única instrução — o Postgres resolve o conflito sob lock e aplica sobre o valor mais recente:

```ts
await tx
  .insert(centralStock)
  .values({ productId, quantity: delta })
  .onConflictDoUpdate({
    target: centralStock.productId,
    set: { quantity: sql`${centralStock.quantity} + ${delta}`, updatedAt: new Date() },
  });
```

### 2. Primitiva de decremento (condicional + atômica)

`UPDATE` condicional com checagem embutida; se 0 linhas afetadas → saldo insuficiente:

```ts
const [updated] = await tx
  .update(centralStock)
  .set({ quantity: sql`${centralStock.quantity} - ${amount}`, updatedAt: new Date() })
  .where(and(eq(centralStock.productId, productId), gte(centralStock.quantity, amount)))
  .returning({ quantity: centralStock.quantity });

if (!updated) {
  throw new BadRequestException(
    `Estoque insuficiente para ${productName}: disponível ${available}, necessário ${amount}`,
  );
}
```

- Checagem e gravação são a **mesma** instrução → oversell impossível por construção.
- O `available` para a mensagem de erro vem de um `SELECT` de quantidade feito **somente no path de falha** (ou do lock já obtido). Em READ COMMITTED, o segundo `UPDATE` concorrente reavalia o predicado contra o valor novo (EvalPlanQual) → vira 0 linhas → erro.

### 3. `createReplenish` e `createMealOut` — checagem dentro da transação

- Remover o loop de checagem de saldo que roda **fora** da transação.
- Dentro da transação já existente, para cada item com `restockedQuantity > 0`:
  1. Verificar existência do produto (`ensureProductExists`) — nome para a mensagem de erro.
  2. Executar o decremento condicional atômico.
  3. Se 0 linhas → `BadRequestException` → rollback de todos os movimentos da transação.
  4. Insert dos movimentos (`CONSUMPTION`/`REPLENISH`/`MEAL_OUT`).
- Para `createReplenish` com múltiplos itens, qualquer falha desfaz todos os inserts (rollback).

### 4. `CentralStockService.increment/decrement`

- `increment`: upsert atômico (mesmo padrão da primitiva 1), mantendo `NotFoundException` para produto inexistente.
- `decrement`: `UPDATE` condicional atômico (primitiva 2), mantendo `NotFoundException` para produto inexistente e `BadRequestException` para saldo insuficiente. Padronizar mensagem de saldo insuficiente para PT com nome do produto (hoje é EN "Insufficient stock: available X, required Y").

### 5. CHECK constraint no banco

- Adicionar no schema `apps/api/src/db/schema/central-stock.ts`:

```ts
export const centralStock = pgTable(
  'central_stock',
  { ... },
  (table) => [check('central_stock_quantity_nonnegative', sql`${table.quantity} >= 0`)],
);
```

- Gerar migração com `drizzle-kit generate` e aplicar (dev + test).

## Arquivos

- Modify: `apps/api/src/stock-movements/stock-movements.service.ts`
- Modify: `apps/api/src/central-stock/central-stock.service.ts`
- Modify: `apps/api/src/db/schema/central-stock.ts`
- Create: migração drizzle
- Test: `apps/api/src/stock-movements/stock-movements.service.spec.ts`
- Test: `apps/api/src/central-stock/central-stock.service.spec.ts`
- Test: `apps/api/test/stock-movements.e2e-spec.ts`

## Testes

**Unit — `stock-movements.service.spec.ts`:**
- Replenish com saldo insuficiente dentro da transação → rollback: nenhum movimento persistido e estoque inalterado (determinístico).
- Concorrência: `Promise.all` de N decrementos/replenishes com saldo inicial fixo → invariante: `estoque_final = saldo_inicial - sucessos`, nunca negativo, `sucessos <= saldo_inicial` (regressão; pode ser flaky com o código antigo).
- Meal-out com saldo insuficiente → rollback da transação.

**Unit — `central-stock.service.spec.ts`:**
- `increment`: cria linha se não existe; soma corretamente; `NotFoundException` para produto inexistente.
- `decrement`: subtrai; `BadRequestException` se insuficiente (mensagem PT com nome); `NotFoundException` para produto inexistente.
- Concorrência de `decrement` (invariante).

**E2E — `stock-movements.e2e-spec.ts`:**
- Repetir replenish até zerar; verificar `400` no excedente (determinístico).
- Meal-out excedente → `400`.

## Verificação

- `pnpm --filter @nutrigest/api test`
- `pnpm --filter @nutrigest/api test:e2e`
- `pnpm lint`
- `pnpm build:api`

## Fora de escopo

- `update` (PATCH `/central-stock/:id`) mantém set absoluto — já valida `min(0)` no DTO e passa a ter o CHECK como rede de segurança.
- Advisory locks / isolamento SERIALIZABLE (overkill).
- Concorrência 100% determinística no teste (impossível contra banco real sem forçar a janela de race).

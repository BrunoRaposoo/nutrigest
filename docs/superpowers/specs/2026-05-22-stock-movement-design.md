# StockMovement — Design Doc

## Contexto

StockMovement registra toda movimentação de estoque do Nutrigest. Cada registro representa uma operação atômica que também atualiza o saldo no CentralStock.

Três tipos de movimento:
- **IN** — Entrada de mercadorias (aumenta estoque)
- **REPLENISH** — Reposição de frigobar (diminui estoque)
- **MEAL_OUT** — Retirada de marmita (diminui estoque)

## Schema

```typescript
export const stockMovementTypeEnum = pgEnum('stock_movement_type', ['IN', 'REPLENISH', 'MEAL_OUT']);

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: stockMovementTypeEnum('type').notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(), // sempre positivo
  room: integer('room'), // nullable, apenas REPLENISH
  userId: uuid('user_id').references(() => users.id).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## CentralStock — novos métodos

- `increment(productId, amount)` — adiciona quantidade ao estoque
- `decrement(productId, amount)` — subtrai quantidade, valida saldo >= 0

Ambos verificam existência do produto e usam upsert.

## Endpoints

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| GET | `/stock-movements` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar movimentações |
| POST | `/stock-movements/in` | JWT | ADMIN, TECHNICIAN | Entrada batch |
| POST | `/stock-movements/replenish/:room` | JWT | ADMIN, TECHNICIAN, OPERATOR | Reposição frigobar |
| POST | `/stock-movements/meal-out` | JWT | ADMIN, TECHNICIAN, OPERATOR | Retirada marmita |

### GET /stock-movements

Query params (opcionais):
- `type` — filtrar por tipo: IN | REPLENISH | MEAL_OUT
- `room` — filtrar por quarto
- `from` — data início (ISO datetime)
- `to` — data fim (ISO datetime)
- `page` — página (default 1)
- `limit` — itens por página (default 20, max 100)

Resposta:
```json
[
  {
    "id": "uuid",
    "type": "IN",
    "productId": "uuid",
    "productName": "Água Mineral 500ml",
    "productCategory": "BEVERAGE",
    "quantity": 50,
    "room": null,
    "userId": "uuid",
    "userName": "Admin",
    "description": "Nota fiscal #1234",
    "createdAt": "2026-05-22T..."
  }
]
```

### POST /stock-movements/in

Body:
```json
{
  "items": [
    { "productId": "uuid", "quantity": 50 }
  ],
  "description": "Nota fiscal #123"
}
```

Cria N movimentos IN, incrementa CentralStock para cada item. Atômico (transação).

### POST /stock-movements/replenish/:room

Body:
```json
{
  "items": [
    { "productId": "uuid", "consumedQuantity": 3 }
  ]
}
```

Cria N movimentos REPLENISH, decrementa CentralStock. Valida saldo antes.
- 404 se quarto inválido
- 400 se estoque insuficiente

### POST /stock-movements/meal-out

Body:
```json
{
  "productId": "uuid",
  "quantity": 2
}
```

Cria 1 movimento MEAL_OUT, decrementa CentralStock. Valida saldo.

## DTOs

```typescript
// create-in-movement.dto.ts
export const CreateInMovementSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
  description: z.string().optional(),
});

// create-replenish-movement.dto.ts
export const CreateReplenishMovementSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    consumedQuantity: z.number().int().min(1),
  })).min(1),
});

// create-meal-out-movement.dto.ts
export const CreateMealOutMovementSchemaSingle = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

// list-movements.dto.ts
export const ListMovementsSchema = z.object({
  type: z.enum(['IN', 'REPLENISH', 'MEAL_OUT']).optional(),
  room: z.coerce.number().int().min(101).max(110).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

## RBAC

| Role | GET | POST IN | POST REPLENISH | POST MEAL_OUT |
|------|-----|---------|----------------|---------------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| TECHNICIAN | ✅ | ✅ | ✅ | ✅ |
| OPERATOR | ✅ | — | ✅ | ✅ |

## Transações

Toda operação de criação de movimento executa em transação:
1. Insere registro(s) em stock_movements
2. Atualiza (upsert) central_stock com o delta correspondente

Se qualquer passo falha, tudo é revertido.

## Estrutura de módulos

```
apps/api/src/stock-movements/
├── dto/
│   ├── create-in-movement.dto.ts
│   ├── create-replenish-movement.dto.ts
│   ├── create-meal-out-movement.dto.ts
│   └── list-movements.dto.ts
├── stock-movements.controller.ts
├── stock-movements.module.ts
├── stock-movements.service.ts
└── stock-movements.service.spec.ts
```

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/db/schema/stock-movements.ts` | NOVO |
| `src/db/schema/index.ts` | Exportar stockMovements + enum |
| `src/stock-movements/dto/*.ts` | NOVOS (4 DTOs) |
| `src/stock-movements/stock-movements.service.ts` | NOVO |
| `src/stock-movements/stock-movements.controller.ts` | NOVO |
| `src/stock-movements/stock-movements.module.ts` | NOVO |
| `src/stock-movements/stock-movements.service.spec.ts` | NOVO |
| `src/central-stock/central-stock.service.ts` | Adicionar increment/decrement |
| `src/central-stock/central-stock.service.spec.ts` | Testes para novos métodos |
| `src/app.module.ts` | Importar StockMovementsModule |
| `test/stock-movements.e2e-spec.ts` | NOVO |
| `docs/AGENTS.md` | Tabela de endpoints |
| `docs/TODO.md` | Marcar 5, 6, 7 |

## Testes

### Unitários (CentralStockService — novos)
- increment: adiciona ao estoque existente
- increment: cria entrada se não existir
- increment: produto inexistente → NotFoundException
- decrement: subtrai do estoque
- decrement: estoque insuficiente → BadRequestException
- decrement: produto inexistente → NotFoundException

### Unitários (StockMovementsService)
- createIn: cria movimentos + incrementa estoque
- createIn: batch com múltiplos produtos
- createIn: produto inexistente → NotFoundException
- createReplenish: cria movimentos + decrementa estoque
- createReplenish: quarto inválido → NotFoundException
- createReplenish: estoque insuficiente → BadRequestException
- createMealOut: cria movimento + decrementa estoque
- createMealOut: estoque insuficiente → BadRequestException
- createMealOut: produto inexistente → NotFoundException
- findAll: retorna array com joins
- findAll: filtra por type
- findAll: filtra por room
- findAll: paginação

### E2E
- GET /stock-movements sem auth → 401
- GET /stock-movements vazio → 200 + array
- POST /stock-movements/in → 201
- POST /stock-movements/in batch → 201 + 2 itens
- POST /stock-movements/in como OPERATOR → 403
- POST /stock-movements/in produto inexistente → 404
- POST /stock-movements/in items vazio → 400
- POST /stock-movements/replenish/:room → 201
- POST /stock-movements/replenish/:room como OPERATOR → 201
- POST /stock-movements/replenish/:room estoque insuficiente → 400
- POST /stock-movements/replenish/999 → 404
- POST /stock-movements/meal-out → 201
- POST /stock-movements/meal-out como OPERATOR → 201
- POST /stock-movements/meal-out estoque insuficiente → 400
- POST /stock-movements/meal-out produto inexistente → 404
- GET /stock-movements?type=IN → filtra corretamente
- GET /stock-movements?page=1&limit=5 → paginação

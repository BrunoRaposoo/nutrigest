# MinibarStandard — Design Doc

## Contexto

MinibarStandard define a configuração de cada frigobar: quais produtos devem estar em cada quarto e em qual quantidade. Serve como referência para a operação de reposição (StockMovement REPLENISH, etapa 6).

Cada quarto (101-110) pode ter múltiplos produtos cadastrados, cada um com uma quantidade padrão esperada.

## Schema

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

- `room` — inteiro entre 101 e 110 (validado via Zod)
- `productId` — FK → products.id, cascade on delete
- `standardQuantity` — inteiro >= 1, default 1
- Unique constraint: (room, productId) — um produto aparece no máximo uma vez por quarto

## Endpoints

### GET /minibar-standard/rooms

Retorna lista fixa de quartos disponíveis:

```json
[101, 102, 103, 104, 105, 106, 107, 108, 109, 110]
```

Auth: JWT (ADMIN, TECHNICIAN, OPERATOR)

### GET /minibar-standard/:room

Retorna o padrão de um quarto com dados do produto:

```json
[
  {
    "productId": "uuid",
    "productName": "Água Mineral 500ml",
    "productCategory": "BEVERAGE",
    "productImageUrl": "/uploads/...",
    "standardQuantity": 3,
    "createdAt": "2026-05-22T..."
  }
]
```

Auth: JWT (ADMIN, TECHNICIAN, OPERATOR)
- 400 se quarto inválido (fora de 101-110)

### POST /minibar-standard/:room

Adicionar produto ao padrão do quarto (upsert — se já existir, atualiza):

Body:
```json
{
  "productId": "uuid",
  "standardQuantity": 3
}
```

Auth: JWT (ADMIN, TECHNICIAN)
- 400 se quarto inválido (fora de 101-110)
- 404 se productId não existir

### PATCH /minibar-standard/:room/:productId

Atualizar quantidade padrão de um produto no quarto:

Body:
```json
{
  "standardQuantity": 5
}
```

Auth: JWT (ADMIN, TECHNICIAN)
- 404 se quarto inválido ou entrada não encontrada

### DELETE /minibar-standard/:room/:productId

Remover produto do padrão do quarto:

Auth: JWT (ADMIN, TECHNICIAN)
- 204 No Content
- 404 se entrada não encontrada

## DTOs

```typescript
// add-minibar-item.dto.ts
export const AddMinibarItemSchema = z.object({
  productId: z.string().uuid(),
  standardQuantity: z.number().int().min(1),
});

// update-minibar-item.dto.ts
export const UpdateMinibarItemSchema = z.object({
  standardQuantity: z.number().int().min(1),
});
```

### RBAC

| Role | GET rooms | GET :room | POST :room | PATCH :room/:pid | DELETE :room/:pid |
|------|-----------|-----------|------------|------------------|-------------------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| TECHNICIAN | ✅ | ✅ | ✅ | ✅ | ✅ |
| OPERATOR | ✅ | ✅ | — | — | — |

## Estrutura de módulos

```
apps/api/src/minibar-standard/
├── dto/
│   ├── add-minibar-item.dto.ts
│   └── update-minibar-item.dto.ts
├── minibar-standard.controller.ts
├── minibar-standard.module.ts
├── minibar-standard.service.ts
└── minibar-standard.service.spec.ts
```

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/db/schema/minibar-standard.ts` | NOVO — schema Drizzle |
| `src/db/schema/index.ts` | Exportar minibarStandard |
| `src/minibar-standard/dto/*.ts` | NOVOS — DTOs Zod |
| `src/minibar-standard/minibar-standard.service.ts` | NOVO |
| `src/minibar-standard/minibar-standard.controller.ts` | NOVO |
| `src/minibar-standard/minibar-standard.module.ts` | NOVO |
| `src/minibar-standard/minibar-standard.service.spec.ts` | NOVO — testes unitários |
| `test/minibar-standard.e2e-spec.ts` | NOVO — testes e2e |
| `src/app.module.ts` | Importar MinibarStandardModule |
| `docs/AGENTS.md` | Atualizar tabela de endpoints |
| `docs/TODO.md` | Marcar etapa 4 |

## Testes

### Unitários (MinibarStandardService)

- findAll(room): retorna array com itens do padrão (vazio se sem itens)
- findAll(room): quarto inválido → NotFoundException
- add(room, dto): adiciona item ao padrão → retorna item
- add(room, dto): upsert — substitui se já existe
- add: productId inexistente → NotFoundException
- update(room, productId, dto): atualiza quantity → retorna atualizado
- update: entrada inexistente → NotFoundException
- remove(room, productId): remove → void
- remove: entrada inexistente → NotFoundException

### E2E

- GET /minibar-standard/rooms → 200 + array com 10 números
- GET /minibar-standard/:room sem auth → 401
- GET /minibar-standard/:room vazio → 200 + []
- GET /minibar-standard/:room com itens → 200 + array com productId, productName, etc
- POST /minibar-standard/:room → 201 + item criado
- POST /minibar-standard/:room duplicado → 200 (upsert, atualiza)
- POST /minibar-standard/:room com productId inexistente → 404
- POST /minibar-standard/:room como OPERATOR → 403
- POST /minibar-standard/999 → 400 (quarto inválido)
- PATCH /minibar-standard/:room/:productId → 200
- PATCH entrada inexistente → 404
- DELETE /minibar-standard/:room/:productId → 204
- DELETE entrada inexistente → 404

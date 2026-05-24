# CentralStock — Design Doc

## Contexto

CentralStock é a tabela de inventário central do Nutrigest. Mantém o saldo agregado atual de cada produto no estoque. Uma linha por produto (1:1).

Serve como fonte da verdade para todos os fluxos operacionais futuros: entrada de mercadorias (etapa 5), reposição de frigobar (etapa 6) e retirada de marmitas (etapa 7).

## Escopo (etapa 3)

- Tabela `central_stock` com `productId` (PK, FK → products), `quantity` (default 0), `updatedAt`
- Visualização do estoque (listar todos + buscar por produto)
- Ajuste manual de quantidade (valor absoluto, ADMIN/TECHNICIAN)
- Seed: criar registro com quantity 0 para cada produto existente
- Proteção: impedir deleção de produto com estoque > 0
- Sem movimentações automáticas (StockMovements será etapa 5-7)

## Schema

```typescript
export const centralStock = pgTable('central_stock', {
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .primaryKey()
    .notNull(),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

- `productId` é PK (não existe PK separada — é a própria FK)
- `onDelete: cascade` — se o produto for deletado (quando quantity = 0), o estoque é removido junto
- `quantity` é inteiro, min 0, default 0
- Migração gerada com `drizzle-kit generate`

## Endpoints

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| GET | `/central-stock` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar todos (com dados do produto) |
| GET | `/central-stock/:productId` | JWT | ADMIN, TECHNICIAN, OPERATOR | Buscar por productId |
| PATCH | `/central-stock/:productId` | JWT | ADMIN, TECHNICIAN | Ajustar quantidade |

### GET /central-stock

Retorna array com JOIN da tabela products:

```json
[
  {
    "productId": "uuid",
    "productName": "Água Mineral 500ml",
    "productCategory": "BEVERAGE",
    "productImageUrl": "/uploads/...",
    "quantity": 50,
    "updatedAt": "2026-05-22T..."
  }
]
```

### GET /central-stock/:productId

Retorna objeto único no mesmo formato. 404 se produto não existe.

### PATCH /central-stock/:productId

Body (JSON):
```json
{ "quantity": 50 }
```

- `quantity` ≥ 0 (Zod valida)
- Se produto não tem registro de estoque, cria automaticamente com a quantity informada
- Se produto não existe, retorna 404
- Atualiza `updatedAt`

## RBAC

- `ADMIN` e `TECHNICIAN`: leitura + escrita
- `OPERATOR`: apenas leitura

## Proteção na deleção de produtos

`ProductsService.remove()` deve ser modificado para:

1. Verificar se `CentralStock.quantity > 0` para o produto
2. Se sim → lançar `BadRequestException` com mensagem "Cannot delete product with existing stock. Adjust stock first."
3. Se quantity === 0 → permite deleção normalmente (cascade remove o registro)

## Estrutura de módulos

```
apps/api/src/central-stock/
├── dto/
│   └── update-stock.dto.ts       # Zod: { quantity: z.number().int().min(0) }
├── central-stock.controller.ts    # 3 endpoints + Swagger
├── central-stock.module.ts        # Importa DbModule
└── central-stock.service.ts       # findAll, findOne, update
```

- Module separado seguindo padrão existente (products, users, auth)
- ProductsService injeta CentralStockService via import do module

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/db/schema/central-stock.ts` | NOVO — schema Drizzle |
| `src/db/schema/index.ts` | Exportar centralStock |
| `src/db/seed-runner.ts` | Seed: criar registro para cada produto |
| `src/central-stock/dto/update-stock.dto.ts` | NOVO |
| `src/central-stock/central-stock.service.ts` | NOVO |
| `src/central-stock/central-stock.controller.ts` | NOVO |
| `src/central-stock/central-stock.module.ts` | NOVO |
| `src/central-stock/central-stock.service.spec.ts` | NOVO — testes unitários |
| `src/products/products.service.ts` | Modificar remove() para checar estoque |
| `src/products/products.module.ts` | Importar CentralStockModule |
| `test/central-stock.e2e-spec.ts` | NOVO — testes e2e |
| `test/products.e2e-spec.ts` | Adicionar teste: deletar produto com estoque → 400 |
| `docs/AGENTS.md` | Atualizar tabela de endpoints |
| `docs/TODO.md` | Marcar etapa 3 |

## Testes

### Unitários (CentralStockService)

- findAll: retorna array (pode ser vazio se sem produtos)
- findOne: retorna estoque de produto específico
- findOne: produto não encontrado → NotFoundException
- update: define quantity → retorna registro atualizado
- update: produto sem registro → cria automaticamente (upsert)

### Unitários (ProductsService — modificação)

- remove: produto com stock > 0 → BadRequestException
- remove: produto com stock === 0 → deleta normalmente

### E2E (central-stock)

- GET listar como ADMIN → 200
- GET listar como OPERATOR → 200
- GET sem auth → 401
- GET por ID → 200 + dados do produto
- GET por ID inexistente → 404
- PATCH ajustar como ADMIN → 200
- PATCH ajustar como TECHNICIAN → 200
- PATCH ajustar como OPERATOR → 403
- PATCH com quantity negativo → 400
- PATCH para produto inexistente → 404
- PATCH cria registro automaticamente se não existir

### E2E (products — modificação)

- DELETE produto com stock > 0 → 400
- DELETE produto com stock === 0 → 200

# Stock Movements Redesign

> **Data:** 2026-05-25
> **Status:** Draft
> **Objetivo:** Replanejar o módulo de movimentações para UX intuitiva, com separação clara entre consumo de quarto, reposição de frigobar e retirada de marmitas.

## Problemas Identificados

1. Frontend solicita UUID do produto — inviável para usuários que não conhecem IDs
2. Não há integração com a lista de produtos padrão de cada quarto (minibar-standard)
3. Interface não é intuitiva para operadores com pouca familiaridade com tecnologia
4. Consumo do paciente e reposição física do quarto estão misturados no mesmo conceito
5. Marmitas (MEAL_OUT) não têm campo de observação para controle de destino

## Regras de Negócio

- **Entrada (IN):** Mercadorias entram no estoque central → incrementa estoque central
- **Consumo (CONSUMPTION):** Paciente consumiu itens do frigobar → registro informativo, NÃO impacta estoque central
- **Reposição (REPLENISH):** Operador retirou do estoque central para reabastecer o quarto → decrementa estoque central
- **Retirada de Marmita (MEAL_OUT):** Marmita retirada do estoque central para funcionários, acompanhantes, etc. → decrementa estoque central, com observação obrigatória

## Schema (Banco de Dados)

### Migration: Alterar enum `stock_movement_type`

**Antes:**
```typescript
'IN' | 'REPLENISH' | 'MEAL_OUT'
```

**Depois:**
```typescript
'IN' | 'CONSUMPTION' | 'REPLENISH' | 'MEAL_OUT'
```

### Tabela `stock_movements` (inalterada)

```typescript
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: stockMovementTypeEnum('type').notNull(),           // NOVO: CONSUMPTION adicionado
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  room: integer('room'),                                    // usado por CONSUMPTION + REPLENISH
  userId: uuid('user_id').references(() => users.id).notNull(),
  description: text('description'),                         // obrigatório para MEAL_OUT
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Estratégia da migration

1. Criar novo enum `stock_movement_type_new` com `'IN'`, `'CONSUMPTION'`, `'REPLENISH'`, `'MEAL_OUT'`
2. ALTER TABLE stock_movements ALTER COLUMN type TYPE stock_movement_type_new USING (type::text::stock_movement_type_new)
3. Mapear `'REPLENISH'` antigo → `'REPLENISH'` novo (movimentações existentes permanecem como REPLENISH para não quebrar histórico)
4. Dropar enum `stock_movement_type`
5. Renomear `stock_movement_type_new` → `stock_movement_type`

## API (Endpoints)

### `POST /stock-movements/replenish/:room` (refatorado)

**Payload:**
```json
{
  "items": [
    {
      "productId": "uuid-do-produto",
      "consumedQuantity": 3,
      "restockedQuantity": 3
    }
  ]
}
```

**Comportamento:**
1. Valida quarto (101-110)
2. Para cada item, valida produto existe
3. Verifica estoque central suficiente para `restockedQuantity`
4. Transação: cria registro `CONSUMPTION` com `consumedQuantity` + registro `REPLENISH` com `restockedQuantity`
5. Decrementa estoque central em `restockedQuantity`
6. Retorna os registros criados

### `POST /stock-movements/meal-out` (refatorado)

**Payload:**
```json
{
  "productId": "uuid-do-produto",
  "quantity": 2,
  "description": "Funcionário João - Cozinha"
}
```

**Mudanças:** `description` agora é obrigatório.

### `POST /stock-movements/in` (refatorado)

Payload com mesma estrutura, mas frontend envia `productId` resolvido via busca por nome.

### `GET /stock-movements` (atualizado)

Filtros existentes + suporte ao novo tipo `CONSUMPTION`.

### Observação sobre resolução de produto por nome

O backend **não** fará busca por nome internamente. O frontend:
1. Carrega `GET /products` uma vez
2. Usa busca local (autocomplete) para encontrar produtos pelo nome
3. Envia sempre o `productId` (UUID) para o backend

## Frontend (UX/UI)

### Estrutura de Tabs

| Tab | Label | Descrição |
|---|---|---|
| 1 | Lista | Histórico de movimentações (mobile: cards, desktop: tabela) |
| 2 | Entrada | Registro de entrada de mercadorias |
| 3 | Quartos | Reposição de frigobar por quarto |
| 4 | Marmitas | Retirada de marmitas |

### Tab "Quartos" (principal)

1. Dropdown grande seleciona quarto (101-110)
2. Ao selecionar, carrega `GET /minibar-standard/:room`
3. Exibe lista de produtos do quarto com:
   - Nome do produto + categoria (badge)
   - Quantidade padrão (exibida como referência)
   - **Stepper "Consumido"**: 0 até 99
   - **Stepper "Reposto"**: 0 até 99
4. Botão "Finalizar Reposição" no final da página
5. Ao submeter: `POST /stock-movements/replenish/:room`

### Tab "Marmitas"

1. Autocomplete de produtos
2. Stepper de quantidade
3. Campo de texto "Destino/Observação" (obrigatório)
4. Botão "Registrar Retirada"
5. Abaixo: lista das últimas 5 retiradas (feedback imediato)

### Tab "Entrada" (reformulada)

1. Lista dinâmica de itens
2. Cada item: autocomplete de produto + stepper de quantidade
3. Botão "+ Adicionar Item"
4. Campo "Descrição" opcional
5. Botão "Registrar Entrada"

### Tab "Lista" (reformulada)

**Mobile:** Cards com badge colorido, nome do produto, quantidade, quarto (se aplicável), observação (se MEAL_OUT), data relativa
**Desktop:** Tabela completa
**Filtros:** Tipo, quarto, período

## Novos Componentes (Frontend)

- `ProductSelect` — Autocomplete com busca por nome, exibe imagem + nome + categoria
- `QuantityStepper` — Botões -/+ com valor numérico
- `RoomSelect` — Dropdown numerado (101-110)
- `MovementCard` — Card para listagem mobile

## Fluxo de Dados

### Reposição de Quarto
```
Usuário seleciona quarto →
  GET /minibar-standard/:room →
  Renderiza produtos com steppers →
  Usuário preenche consumido/reposto →
  POST /stock-movements/replenish/:room {
    items: [{ productId, consumedQuantity, restockedQuantity }]
  } →
  Backend: transação → INSERT CONSUMPTION + INSERT REPLENISH + decrement central →
  Invalida queries (movements + central-stock)
```

### Retirada de Marmita
```
Usuário seleciona produto →
  Preenche quantidade + destino →
  POST /stock-movements/meal-out {
    productId, quantity, description
  } →
  Backend: INSERT MEAL_OUT + decrement central →
  Invalida queries
```

## Impacto no Estoque Central por Tipo

| Movimento | Impacto Central Stock |
|---|---|
| IN | +quantity |
| CONSUMPTION | 0 (nenhum) |
| REPLENISH | -restockedQuantity |
| MEAL_OUT | -quantity |

## Checklist de Implementação

### Backend
- [ ] Migration: alterar enum stock_movement_type
- [ ] Migration: mapear REPLENISH antigos (não quebrar histórico)
- [ ] Atualizar DTOs
- [ ] Refatorar StockMovementsService
- [ ] Atualizar StockMovementsController e Swagger
- [ ] Atualizar testes

### Frontend
- [ ] Criar componentes: ProductSelect, QuantityStepper, RoomSelect, MovementCard
- [ ] Atualizar types e hooks
- [ ] Refatorar stock-movements.tsx

### Geral
- [ ] Lint + Build + Testes
- [ ] Atualizar docs

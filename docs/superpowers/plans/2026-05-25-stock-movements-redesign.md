# Stock Movements Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign stock movements module with intuitive UX, separate CONSUMPTION from REPLENISH, and add product search by name.

**Architecture:** Backend: mutate stock_movement_type enum to add 'CONSUMPTION', refactor replenish to create CONSUMPTION + REPLENISH records in one transaction. Frontend: new reusable components (ProductSelect, QuantityStepper, RoomSelect, MovementCard), redesigned page with 4 intuitive tabs.

**Tech Stack:** NestJS + Fastify + Drizzle ORM + PostgreSQL + React + Vite + TypeScript + Tailwind CSS v4 + React Query + React Hook Form + Zod

---

### Task 1: Migration — Add CONSUMPTION to stock_movement_type enum

**Files:**
- Modify: `apps/api/src/db/schema/stock-movements.ts`
- Create: Drizzle migration file

- [ ] **Step 1: Update the enum in schema file**

In `apps/api/src/db/schema/stock-movements.ts`, change the enum to include CONSUMPTION:
```typescript
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'IN',
  'CONSUMPTION',
  'REPLENISH',
  'MEAL_OUT',
]);
```

- [ ] **Step 2: Generate migration**

```bash
pnpm --filter @nutrigest/api exec drizzle-kit generate
```

- [ ] **Step 3: Edit migration to preserve existing data**

The generated migration will try to DROP and recreate the column. Replace its content with a safe ALTER TYPE:
```sql
-- Custom migration: safely add CONSUMPTION to stock_movement_type enum
CREATE TYPE stock_movement_type_new AS ENUM ('IN', 'CONSUMPTION', 'REPLENISH', 'MEAL_OUT');
ALTER TABLE stock_movements ALTER COLUMN type TYPE stock_movement_type_new USING (type::text::stock_movement_type_new);
DROP TYPE stock_movement_type;
ALTER TYPE stock_movement_type_new RENAME TO stock_movement_type;
```

- [ ] **Step 4: Apply migration**

```bash
pnpm --filter @nutrigest/api exec drizzle-kit migrate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/stock-movements.ts
git add apps/api/src/db/migrations/
git commit -m "feat: add CONSUMPTION type to stock_movement_type enum"
```

---

### Task 2: Update DTOs

**Files:**
- Modify: `apps/api/src/stock-movements/dto/create-replenish-movement.dto.ts`
- Modify: `apps/api/src/stock-movements/dto/create-meal-out-movement.dto.ts`
- Modify: `apps/api/src/stock-movements/dto/list-movements.dto.ts`

- [ ] **Step 1: Update `create-replenish-movement.dto.ts`**

Add `restockedQuantity` field, allow `consumedQuantity` to be 0:
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateReplenishMovementSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        consumedQuantity: z.number().int().min(0),
        restockedQuantity: z.number().int().min(0),
      }),
    )
    .min(1),
});

export class CreateReplenishMovementDto extends createZodDto(
  CreateReplenishMovementSchema,
) {}

export type CreateReplenishMovementData = z.infer<
  typeof CreateReplenishMovementSchema
>;
export type ReplenishItem = CreateReplenishMovementData['items'][number];
```

- [ ] **Step 2: Update `create-meal-out-movement.dto.ts`**

Make `description` required:
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateMealOutMovementSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  description: z.string().min(1, 'Descrição/destino é obrigatório'),
});

export class CreateMealOutMovementDto extends createZodDto(
  CreateMealOutMovementSchema,
) {}

export type CreateMealOutMovementData = z.infer<
  typeof CreateMealOutMovementSchema
>;
```

- [ ] **Step 3: Update `list-movements.dto.ts`**

Add CONSUMPTION to the type filter:
```typescript
export const ListMovementsSchema = z.object({
  type: z.enum(['IN', 'CONSUMPTION', 'REPLENISH', 'MEAL_OUT']).optional(),
  room: z.coerce.number().int().min(101).max(110).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

- [ ] **Step 4: Build check**

```bash
pnpm --filter @nutrigest/api build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stock-movements/dto/
git commit -m "feat: update DTOs for new movement model"
```

---

### Task 3: Refactor StockMovementsService

**Files:**
- Modify: `apps/api/src/stock-movements/stock-movements.service.ts`

- [ ] **Step 1: Refactor `createReplenish` method**

Replace the current implementation with one that creates both CONSUMPTION and REPLENISH records:

```typescript
async createReplenish(
  room: number,
  dto: CreateReplenishMovementData,
  userId: string,
) {
  if (!VALID_ROOMS.includes(room)) {
    throw new NotFoundException('Room not found');
  }

  for (const item of dto.items) {
    await this.ensureProductExists(item.productId);
    if (item.restockedQuantity > 0) {
      const qty = await this.centralStockService.getQuantity(item.productId);
      if (qty < item.restockedQuantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}: available ${qty}, required ${item.restockedQuantity}`,
        );
      }
    }
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

        await this.upsertCentralStock(
          tx,
          item.productId,
          -item.restockedQuantity,
        );

        records.push(replenish);
      }
    }

    return records;
  });

  return created;
}
```

- [ ] **Step 2: Refactor `createMealOut` to pass description**

```typescript
async createMealOut(dto: CreateMealOutMovementData, userId: string) {
  await this.ensureProductExists(dto.productId);

  const qty = await this.centralStockService.getQuantity(dto.productId);
  if (qty < dto.quantity) {
    throw new BadRequestException(
      `Insufficient stock: available ${qty}, required ${dto.quantity}`,
    );
  }

  const [movement] = await this.db.db.transaction(async (tx) => {
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

    await this.upsertCentralStock(tx, dto.productId, -dto.quantity);

    return [m];
  });

  return movement;
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @nutrigest/api build
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/stock-movements/stock-movements.service.ts
git commit -m "feat: refactor replenish to create CONSUMPTION + REPLENISH records"
```

---

### Task 4: Update Tests

**Files:**
- Modify: `apps/api/src/stock-movements/stock-movements.service.spec.ts`
- Modify: `apps/api/test/stock-movements.e2e-spec.ts`

- [ ] **Step 1: Update unit tests**

In `stock-movements.service.spec.ts`:
- Update replenish tests to use `consumedQuantity` + `restockedQuantity`
- Verify both CONSUMPTION and REPLENISH records are created
- Verify CONSUMPTION does NOT decrement central stock
- Verify REPLENISH decrements central stock
- Update meal-out tests to include `description`
- Add test for `consumedQuantity = 0` (only restock)
- Add test for `restockedQuantity = 0` (only consumption)

- [ ] **Step 2: Run unit tests**

```bash
pnpm --filter @nutrigest/api test
```

- [ ] **Step 3: Update e2e tests**

In `stock-movements.e2e-spec.ts`:
- Update replenish payloads with new structure
- Add `description` in meal-out tests
- Test full flow: replenish creates CONSUMPTION + REPLENISH

- [ ] **Step 4: Run e2e tests**

```bash
pnpm --filter @nutrigest/api test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/stock-movements/ apps/api/test/
git commit -m "test: update tests for new replenish and meal-out logic"
```

---

### Task 5: Frontend — Types + Hooks

**Files:**
- Modify: `apps/web/src/types/stock.ts`
- Modify: `apps/web/src/hooks/queries/use-movement-queries.ts`
- Create: `apps/web/src/hooks/queries/use-minibar-queries.ts`

- [ ] **Step 1: Update types**

In `apps/web/src/types/stock.ts`:
```typescript
export type MovementType = 'IN' | 'CONSUMPTION' | 'REPLENISH' | 'MEAL_OUT';

export interface CentralStockItem {
  productId: string;
  productName: string;
  productCategory: string;
  productImageUrl: string | null;
  quantity: number;
  updatedAt: string | null;
}

export interface MinibarItem {
  productId: string;
  productName: string;
  productCategory: string;
  productImageUrl: string | null;
  standardQuantity: number;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  productCategory: string;
  quantity: number;
  room: number | null;
  userId: string;
  userName: string;
  description: string | null;
  createdAt: string;
}

export interface MovementFilters {
  type?: MovementType;
  room?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ReplenishItem {
  productId: string;
  productName: string;
  consumedQuantity: number;
  restockedQuantity: number;
}
```

- [ ] **Step 2: Update movement hooks**

In `apps/web/src/hooks/queries/use-movement-queries.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MovementFilters, StockMovement } from '../../types/stock';

export function useMovements(filters: MovementFilters = {}) {
  return useQuery<StockMovement[]>({
    queryKey: ['stock-movements', filters],
    queryFn: () =>
      api.get('/stock-movements', { params: filters }).then((r) => r.data),
  });
}

export function useCreateInMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      items: Array<{ productId: string; quantity: number }>;
      description?: string;
    }) => api.post('/stock-movements/in', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}

export function useCreateReplenish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      room: number;
      items: Array<{
        productId: string;
        consumedQuantity: number;
        restockedQuantity: number;
      }>;
    }) =>
      api.post(`/stock-movements/replenish/${data.room}`, {
        items: data.items,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}

export function useCreateMealOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      productId: string;
      quantity: number;
      description: string;
    }) => api.post('/stock-movements/meal-out', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}
```

- [ ] **Step 3: Create minibar queries hook**

Create `apps/web/src/hooks/queries/use-minibar-queries.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MinibarItem } from '../../types/stock';

export function useMinibarStandard(room: number) {
  return useQuery<MinibarItem[]>({
    queryKey: ['minibar-standard', room],
    queryFn: () => api.get(`/minibar-standard/${room}`).then((r) => r.data),
    enabled: !!room,
  });
}

export function useRooms() {
  return useQuery<number[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/minibar-standard/rooms').then((r) => r.data),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/types/stock.ts apps/web/src/hooks/
git commit -m "feat: update frontend types and hooks for new movement model"
```

---

### Task 6: Frontend — UI Components

**Files:**
- Create: `apps/web/src/components/stock/ProductSelect.tsx`
- Create: `apps/web/src/components/stock/QuantityStepper.tsx`
- Create: `apps/web/src/components/stock/RoomSelect.tsx`
- Create: `apps/web/src/components/stock/MovementCard.tsx`

- [ ] **Step 1: Create `ProductSelect.tsx`**

Autocomplete component that searches products by name:
```tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import type { Product } from '../../types/product';

interface ProductSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  categoryFilter?: string;
}

export default function ProductSelect({
  products,
  value,
  onChange,
  placeholder = 'Buscar produto...',
  categoryFilter,
}: ProductSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, query, categoryFilter]);

  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? query : selected?.name ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 dark:bg-navy-800 dark:border-gray-700"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-navy-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onChange(product.id);
                setQuery('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-navy-700 flex items-center gap-2"
            >
              {product.imageUrl && (
                <img src={product.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
              )}
              <span>{product.name}</span>
              <span className="ml-auto text-xs text-gray-400">
                {product.category === 'MEAL' ? 'Marmita' : 'Bebida'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `QuantityStepper.tsx`**

```tsx
interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-20">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold
                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700
                   transition-colors"
      >
        −
      </button>
      <span className="w-8 text-center text-lg font-semibold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold
                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700
                   transition-colors"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `RoomSelect.tsx`**

```tsx
import { useRooms } from '../../hooks/queries/use-minibar-queries';

interface RoomSelectProps {
  value: number;
  onChange: (room: number) => void;
}

export default function RoomSelect({ value, onChange }: RoomSelectProps) {
  const { data: rooms = [] } = useRooms();

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-navy-800 font-medium cursor-pointer
                 focus:outline-none focus:ring-2 focus:ring-navy-500"
    >
      <option value="" disabled>
        Selecione um quarto
      </option>
      {rooms.map((room) => (
        <option key={room} value={room}>
          Quarto {room}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Create `MovementCard.tsx`**

```tsx
import type { StockMovement } from '../../types/stock';
import { cn, formatDate } from '../../lib/utils';

interface MovementCardProps {
  movement: StockMovement;
}

const typeConfig: Record<
  StockMovement['type'],
  { label: string; color: string }
> = {
  IN: {
    label: 'Entrada',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  CONSUMPTION: {
    label: 'Consumo',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  },
  REPLENISH: {
    label: 'Reposição',
    color:
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  MEAL_OUT: {
    label: 'Marmita',
    color:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

export default function MovementCard({ movement }: MovementCardProps) {
  const cfg = typeConfig[movement.type];

  return (
    <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              cfg.color,
            )}
          >
            {cfg.label}
          </span>
          {movement.room && (
            <span className="text-sm text-gray-500">
              Quarto {movement.room}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatDate(movement.createdAt)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {movement.productName}
        </span>
        <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
          {movement.quantity}x
        </span>
      </div>
      {movement.description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {movement.description}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/stock/
git commit -m "feat: create ProductSelect, QuantityStepper, RoomSelect, MovementCard"
```

---

### Task 7: Frontend — Redesign StockMovements Page

**Files:**
- Rewrite: `apps/web/src/pages/app/stock-movements.tsx`

This is the largest task. The entire page must be rewritten with 4 tabs:

- [ ] **Step 1: Implement tab "Lista"** — Movement cards (mobile) / table (desktop) + filters (type, room, date)
- [ ] **Step 2: Implement tab "Entrada"** — Dynamic list items with ProductSelect + QuantityStepper, description field
- [ ] **Step 3: Implement tab "Quartos"** — RoomSelect → load minibar-standard → display products with Consumed/Replenished steppers
- [ ] **Step 4: Implement tab "Marmitas"** — ProductSelect (filtered to MEAL) + QuantityStepper + destination input
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/app/stock-movements.tsx
git commit -m "feat: redesign stock movements page with intuitive tabs"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Lint check**

```bash
pnpm lint
```

- [ ] **Step 2: Build both apps**

```bash
pnpm build:api && pnpm build:web
```

- [ ] **Step 3: Run API tests**

```bash
pnpm --filter @nutrigest/api test
```

- [ ] **Step 4: Update AGENTS.md** — endpoint table for stock movements
- [ ] **Step 5: Update TODO.md**
- [ ] **Step 6: Commit final**

```bash
git add docs/AGENTS.md docs/TODO.md
git commit -m "docs: update docs with new stock movements model"
```

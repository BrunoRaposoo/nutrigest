# Frontend Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer os erros da API aparecerem para o usuário no frontend (banners dismissíveis), criando um helper único de extração de mensagem e um componente `ErrorBanner`, aplicando-os nas páginas afetadas.

**Architecture:** Duas unidades novas e isoladas — `lib/api-error.ts` (helper puro, testável sem DOM) e `components/ui/error-banner.tsx` (componente de UI com estilo consistente com o tema existente). Aplicação em 4 páginas de app (híbrido `mutation.error` + try/catch), dashboard (erros de download genéricos), e refactor DRY em login/register/minibar.

**Tech Stack:** React 19, Vite, React Query, axios, Vitest + Testing Library, Biome, pnpm workspace `@nutrigest/web`.

---

## Estrutura de Arquivos

- Create: `apps/web/src/lib/api-error.ts` — helper puro `getApiErrorMessage(err)`.
- Create: `apps/web/src/lib/api-error.test.ts` — testes unitários do helper.
- Create: `apps/web/src/components/ui/error-banner.tsx` — componente `ErrorBanner`.
- Create: `apps/web/src/components/ui/error-banner.test.tsx` — testes do componente.
- Modify: `apps/web/src/pages/app/stock-movements.tsx` — banners por tab (IN/Replenish/Meal).
- Modify: `apps/web/src/pages/app/central-stock.tsx` — banner no dialog de ajuste.
- Modify: `apps/web/src/pages/app/products.tsx` — banner no dialog (form) + topo (delete).
- Modify: `apps/web/src/pages/app/users.tsx` — banner no dialog (form) + topo (delete).
- Modify: `apps/web/src/pages/app/dashboard.tsx` — renderiza `error` dos hooks de download.
- Modify: `apps/web/src/hooks/use-download-report.ts` — usa `getApiErrorMessage`.
- Modify: `apps/web/src/pages/auth/login.tsx` — usa `getApiErrorMessage`.
- Modify: `apps/web/src/pages/auth/register.tsx` — usa `getApiErrorMessage`.
- Modify: `apps/web/src/pages/app/minibar-standard.tsx` — usa helper + `ErrorBanner`.

---

### Task 1: Helper `getApiErrorMessage`

**Files:**
- Create: `apps/web/src/lib/api-error.ts`
- Test: `apps/web/src/lib/api-error.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/api-error.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-error';

describe('getApiErrorMessage', () => {
  it('returns message from AxiosError with string response message', () => {
    const err = {
      response: { data: { message: 'Insufficient stock' } },
    };
    expect(getApiErrorMessage(err)).toBe('Insufficient stock');
  });

  it('joins array response messages (Zod validation)', () => {
    const err = {
      response: {
        data: { message: ['name must be at least 2 chars', 'email invalid'] },
      },
    };
    expect(getApiErrorMessage(err)).toBe(
      'name must be at least 2 chars, email invalid',
    );
  });

  it('returns Error.message for network errors', () => {
    const err = new Error('Servidor indisponível. Verifique sua conexão.');
    expect(getApiErrorMessage(err)).toBe(
      'Servidor indisponível. Verifique sua conexão.',
    );
  });

  it('returns generic message when no response and not an Error', () => {
    expect(getApiErrorMessage({ foo: 'bar' })).toBe(
      'Ocorreu um erro inesperado',
    );
  });

  it('returns generic message for null/undefined', () => {
    expect(getApiErrorMessage(null)).toBe('Erro inesperado');
    expect(getApiErrorMessage(undefined)).toBe('Erro inesperado');
  });

  it('returns generic message when response has no message', () => {
    const err = { response: { data: {} } };
    expect(getApiErrorMessage(err)).toBe('Ocorreu um erro inesperado');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nutrigest/web test -- api-error`
Expected: FAIL — "Cannot find module './api-error'"

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/lib/api-error.ts`:

```ts
export function getApiErrorMessage(err: unknown): string {
  if (!err) return 'Erro inesperado';

  const data = (err as { response?: { data?: { message?: unknown } } })
    .response?.data;
  if (data?.message) {
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
  }

  if (err instanceof Error) return err.message;

  return 'Ocorreu um erro inesperado';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nutrigest/web test -- api-error`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api-error.ts apps/web/src/lib/api-error.test.ts
git commit -m "feat: add getApiErrorMessage helper"
```

---

### Task 2: Componente `ErrorBanner`

**Files:**
- Create: `apps/web/src/components/ui/error-banner.tsx`
- Test: `apps/web/src/components/ui/error-banner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ui/error-banner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from './error-banner';

describe('ErrorBanner', () => {
  it('renders the message', () => {
    render(<ErrorBanner message="Estoque insuficiente" />);
    expect(screen.getByText('Estoque insuficiente')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Erro" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByLabelText('Fechar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no close button when onDismiss is absent', () => {
    render(<ErrorBanner message="Erro" />);
    expect(screen.queryByLabelText('Fechar')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nutrigest/web test -- error-banner`
Expected: FAIL — "Cannot find module './error-banner'"

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/ui/error-banner.tsx`:

```tsx
interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar"
          className="shrink-0 font-bold hover:text-red-800 dark:hover:text-red-300"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nutrigest/web test -- error-banner`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/error-banner.tsx apps/web/src/components/ui/error-banner.test.tsx
git commit -m "feat: add ErrorBanner component"
```

---

### Task 3: Banners em `stock-movements.tsx`

**Files:**
- Modify: `apps/web/src/pages/app/stock-movements.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/pages/app/stock-movements.tsx`, after the `Button` import line, add:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
import { getApiErrorMessage } from '../../lib/api-error';
```

- [ ] **Step 2: Add banner to the IN tab**

In the IN tab `<CardContent className="space-y-4">` (line ~319), right before the items map, add:

```tsx
{createIn.isError && (
  <ErrorBanner
    message={getApiErrorMessage(createIn.error)}
    onDismiss={() => createIn.reset()}
  />
)}
```

- [ ] **Step 3: Add banner to the rooms tab**

In the rooms tab `<CardContent className="space-y-6">` (line ~395), right after the `RoomSelect` and before `{selectedRoom ? (`, add:

```tsx
{createReplenish.isError && (
  <ErrorBanner
    message={getApiErrorMessage(createReplenish.error)}
    onDismiss={() => createReplenish.reset()}
  />
)}
```

- [ ] **Step 4: Add banner to the meals tab**

In the meals tab `<CardContent className="space-y-4">` (line ~482), right after the opening div, add:

```tsx
{createMealOut.isError && (
  <ErrorBanner
    message={getApiErrorMessage(createMealOut.error)}
    onDismiss={() => createMealOut.reset()}
  />
)}
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @nutrigest/web test && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/app/stock-movements.tsx
git commit -m "fix: show error banner on stock movements handlers"
```

---

### Task 4: Banner em `central-stock.tsx`

**Files:**
- Modify: `apps/web/src/pages/app/central-stock.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/pages/app/central-stock.tsx`, after the `Card` import line, add:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
import { getApiErrorMessage } from '../../lib/api-error';
```

- [ ] **Step 2: Add banner to the adjust dialog**

In the `Dialog` block (line ~132), inside `{adjustProduct && ( <div className="space-y-4">`, right after the opening `<div className="space-y-4">`, add:

```tsx
{updateMutation.isError && (
  <ErrorBanner
    message={getApiErrorMessage(updateMutation.error)}
    onDismiss={() => updateMutation.reset()}
  />
)}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @nutrigest/web test && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/app/central-stock.tsx
git commit -m "fix: show error banner on central stock adjust"
```

---

### Task 5: Banners em `products.tsx`

**Files:**
- Modify: `apps/web/src/pages/app/products.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/pages/app/products.tsx`, after the `Badge` import line, add:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
import { getApiErrorMessage } from '../../lib/api-error';
```

- [ ] **Step 2: Add error state for the form (edit via api.patch)**

Add a state to the component, after `const [search, setSearch] = useState('');`:

```tsx
const [formError, setFormError] = useState('');
```

- [ ] **Step 3: Wrap `onSubmit` in try/catch**

Replace the `onSubmit` function (lines ~67-75) with:

```tsx
const onSubmit = async (data: ProductForm) => {
  setFormError('');
  try {
    if (editingProduct) {
      await api.patch(`/products/${editingProduct.id}`, data);
      qc.invalidateQueries({ queryKey: ['products'] });
    } else {
      await createProduct.mutateAsync(data);
    }
    setDialogOpen(false);
  } catch (err) {
    setFormError(getApiErrorMessage(err));
  }
};
```

- [ ] **Step 4: Add banner inside the dialog**

In the dialog `<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">`, right after the opening `<form ...>` tag, add:

```tsx
{(formError || (createProduct.isError && getApiErrorMessage(createProduct.error))) && (
  <ErrorBanner
    message={formError || getApiErrorMessage(createProduct.error)}
    onDismiss={() => {
      setFormError('');
      createProduct.reset();
    }}
  />
)}
```

- [ ] **Step 5: Add banner at the top for delete errors**

In the page root `<div className="space-y-6 transition-theme">` (line ~88), right after the opening div, add:

```tsx
{deleteProduct.isError && (
  <ErrorBanner
    message={getApiErrorMessage(deleteProduct.error)}
    onDismiss={() => deleteProduct.reset()}
  />
)}
```

- [ ] **Step 6: Clear formError when opening the dialog**

In `openCreate` (line ~51) and `openEdit` (line ~57), add `setFormError('');` as the first statement.

- [ ] **Step 7: Verify build**

Run: `pnpm --filter @nutrigest/web test && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/app/products.tsx
git commit -m "fix: show error banner on products form and delete"
```

---

### Task 6: Banners em `users.tsx`

**Files:**
- Modify: `apps/web/src/pages/app/users.tsx`

- [ ] **Step 1: Add imports**

In `apps/web/src/pages/app/users.tsx`, after the `Badge` import line, add:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
import { getApiErrorMessage } from '../../lib/api-error';
```

- [ ] **Step 2: Add error state for the form**

Add a state to the component, after `const [editingUser, setEditingUser] = useState<User | null>(null);`:

```tsx
const [formError, setFormError] = useState('');
```

- [ ] **Step 3: Wrap `onSubmit` in try/catch**

Replace the `onSubmit` function (lines ~67-81) with:

```tsx
const onSubmit = async (data: UserForm) => {
  setFormError('');
  try {
    if (editingUser) {
      const payload: Record<string, string> = {
        name: data.name,
        email: data.email,
        role: data.role,
      };
      if (data.password) payload.password = data.password;
      await api.patch(`/users/${editingUser.id}`, payload);
      qc.invalidateQueries({ queryKey: ['users'] });
    } else {
      await createUser.mutateAsync(data as Required<typeof data>);
    }
    setDialogOpen(false);
  } catch (err) {
    setFormError(getApiErrorMessage(err));
  }
};
```

- [ ] **Step 4: Add banner inside the dialog**

In the dialog `<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">`, right after the opening `<form ...>` tag, add:

```tsx
{(formError || (createUser.isError && getApiErrorMessage(createUser.error))) && (
  <ErrorBanner
    message={formError || getApiErrorMessage(createUser.error)}
    onDismiss={() => {
      setFormError('');
      createUser.reset();
    }}
  />
)}
```

- [ ] **Step 5: Add banner at the top for delete errors**

In the page root `<div className="space-y-6 transition-theme">` (line ~110), right after the opening div, add:

```tsx
{deleteUser.isError && (
  <ErrorBanner
    message={getApiErrorMessage(deleteUser.error)}
    onDismiss={() => deleteUser.reset()}
  />
)}
```

- [ ] **Step 6: Clear formError when opening the dialog**

In `openCreate` (line ~55) and `openEdit` (line ~61), add `setFormError('');` as the first statement.

- [ ] **Step 7: Verify build**

Run: `pnpm --filter @nutrigest/web test && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/app/users.tsx
git commit -m "fix: show error banner on users form and delete"
```

---

### Task 7: Dashboard — erros de download

**Files:**
- Modify: `apps/web/src/pages/app/dashboard.tsx`
- Modify: `apps/web/src/hooks/use-download-report.ts`

- [ ] **Step 1: Update `use-download-report.ts` to use the helper**

In `apps/web/src/hooks/use-download-report.ts`, replace the catch block (lines 37-40) with:

```ts
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Erro ao baixar relatório');
    } finally {
```

Add the import at the top:

```ts
import { getApiErrorMessage } from '../lib/api-error';
```

- [ ] **Step 2: Add imports to dashboard.tsx**

In `apps/web/src/pages/app/dashboard.tsx`, after the `Button` import line, add:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
```

- [ ] **Step 3: Destructure error from download hooks**

In `dashboard.tsx`, update each `useConsumptionByRoomCsv/Pdf`, `useMealRankingCsv/Pdf`, `useStockHistoryCsv/Pdf` destructuring to also capture `error`. For example, replace (lines 45-48) with:

```tsx
  const {
    download: downloadConsumptionCsv,
    isDownloading: isConsumptionCsvLoading,
    error: consumptionCsvError,
  } = useConsumptionByRoomCsv(consumptionFrom, consumptionTo);
```

Do the same for the other 5 hooks:
- `useConsumptionByRoomPdf` → `error: consumptionPdfError`
- `useMealRankingCsv` → `error: rankingCsvError`
- `useMealRankingPdf` → `error: rankingPdfError`
- `useStockHistoryCsv` → `error: historyCsvError`
- `useStockHistoryPdf` → `error: historyPdfError`

- [ ] **Step 4: Render banners per export card**

To keep the code DRY, define a small helper inside the component before the `return` (after the hooks, ~line 62):

```tsx
const renderDownloadError = (message: string | null) =>
  message ? <ErrorBanner message={message} /> : null;
```

Then use it at the top of each export card's `<CardContent className="space-y-3">`:
- Card 1 (`Consumo por Quarto`, ~315): `{renderDownloadError(consumptionCsvError || consumptionPdfError)}`
- Card 2 (`Ranking de Marmitas`, ~358): `{renderDownloadError(rankingCsvError || rankingPdfError)}`
- Card 3 (`Histórico de Estoque`, ~412): `{renderDownloadError(historyCsvError || historyPdfError)}`

`ErrorBanner` without `onDismiss` renders no close button, which is acceptable for download errors that clear on the next attempt.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @nutrigest/web test && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/app/dashboard.tsx apps/web/src/hooks/use-download-report.ts
git commit -m "fix: surface download errors on dashboard"
```

---

### Task 8: DRY — login, register, minibar-standard

**Files:**
- Modify: `apps/web/src/pages/auth/login.tsx`
- Modify: `apps/web/src/pages/auth/register.tsx`
- Modify: `apps/web/src/pages/app/minibar-standard.tsx`

- [ ] **Step 1: login.tsx — use the helper**

In `apps/web/src/pages/auth/login.tsx`:
1. Add import after `import { PasswordInput } ...`:

```tsx
import { getApiErrorMessage } from '../../lib/api-error';
```

2. Replace the catch block in `onSubmit` (lines 44-51) with:

```tsx
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err) || 'E-mail ou senha inválidos',
      );
    }
```

- [ ] **Step 2: register.tsx — use the helper**

In `apps/web/src/pages/auth/register.tsx`:
1. Add import after `import { PasswordInput } ...`:

```tsx
import { getApiErrorMessage } from '../../lib/api-error';
```

2. Replace the catch block in `onSubmit` (lines 49-56) with:

```tsx
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'Erro ao criar conta');
    }
```

- [ ] **Step 3: minibar-standard.tsx — use helper + ErrorBanner**

In `apps/web/src/pages/app/minibar-standard.tsx`:
1. Add imports after the `Button` import line:

```tsx
import { ErrorBanner } from '../../components/ui/error-banner';
import { getApiErrorMessage } from '../../lib/api-error';
```

2. Add a second error state, right after `const [error, setError] = useState('');`:

```tsx
const [deleteError, setDeleteError] = useState('');
```

3. Replace the catch block in `handleAdd` (lines 70-77) with:

```tsx
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'Erro ao adicionar item');
    }
```

4. Replace the `handleDelete` function (lines 80-87) with:

```tsx
  const handleDelete = async (productId: string) => {
    if (!window.confirm('Remover item do padrão?')) return;
    setDeleteError('');
    try {
      await deleteMutation.mutateAsync(productId);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err) || 'Erro ao remover item');
    }
  };
```

5. Replace the inline error banner in the Dialog (lines 188-192) with:

```tsx
{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
```

6. Add a banner at the top of the page root `<div className="space-y-6 transition-theme">` (line ~94), right after the opening div:

```tsx
{deleteError && (
  <ErrorBanner message={deleteError} onDismiss={() => setDeleteError('')} />
)}
```

- [ ] **Step 4: Verify build and tests**

Run: `pnpm --filter @nutrigest/web test && pnpm lint && pnpm build:web`
Expected: PASS; no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/auth/login.tsx apps/web/src/pages/auth/register.tsx apps/web/src/pages/app/minibar-standard.tsx
git commit -m "refactor: use getApiErrorMessage and ErrorBanner in login, register and minibar"
```

---

### Task 9: Verificação final

- [ ] **Step 1: Run full web test suite**

Run: `pnpm --filter @nutrigest/web test`
Expected: All tests pass (new api-error + error-banner tests included).

- [ ] **Step 2: Run lint and build**

Run: `pnpm lint && pnpm build:web`
Expected: No errors; build succeeds.

- [ ] **Step 3: Update the master plan progress**

In `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`, update the Etapa 2 row in the progress table from `⬜ pendente` to `✅ concluída` and check off the completed checkboxes in the Etapa 2 section.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-08-11-code-quality-improvements.md
git commit -m "docs: mark frontend error handling stage as complete"
```

---

## Verificação manual (para o usuário)

1. Iniciar API + Web: `pnpm dev:api` e `pnpm dev:web`.
2. Login como admin, ir em **Movimentações → Quartos**, escolher quarto, tentar repor mais itens do que existe em estoque → deve aparecer banner vermelho com `Insufficient stock for product ...` (mensagem do backend).
3. Fechar banner com ×; repetir operação → banner some ao reenviar.
4. Em **Produtos**, criar produto com nome vazio → erro de validação Zod (array) exibido no dialog.
5. Em **Dashboard**, gerar relatório CSV sem produto selecionado no Histórico → mensagem genérica de falha (botão desabilitado; testar com data inválida no backend se possível).
6. Conferir no terminal da API que o erro original aparece nos logs (AllExceptionsFilter).

# Design — Etapa 2: Tratamento de erros no frontend ("nada aparece")

Data: 2026-08-11
Branch: `fix/frontend-error-handling`
Origem: `dev` (`22b40c4`)
Plano mestre: `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`

## Objetivo

Corrigir a **Crítica 2**: chamadas com `mutateAsync` **sem try/catch** em vários
handlers fazem a promise rejeitar silenciosamente quando a API retorna erro
(ex.: estoque insuficiente → `400 Insufficient stock`). O usuário não vê nenhuma
mensagem. Além disso, `use-download-report` captura erro, mas `dashboard.tsx`
nunca renderiza esse erro.

## Decisões (aprovadas pelo usuário)

- **ErrorBanner:** dismissível (botão ×) e persiste (sem timeout), fechado pelo
  usuário ou ao iniciar nova operação.
- **Gestão de estado de erro (híbrido):** handlers que usam `mutateAsync`
  renderizam `<ErrorBanner message={getApiErrorMessage(mutation.error)} />`
  quando `mutation.isError` (React Query reseta o erro automaticamente). Handlers
  que usam `api.patch/post/delete` direto usam try/catch + estado local + banner
  com botão fechar.
- **Dashboard/downloads:** mensagem **genérica** para o usuário
  ("Falha ao baixar relatório"); a causa raiz fica clara nos **logs do
  servidor** (`AllExceptionsFilter` já loga `HttpException` e erros não tratados
  com stack trace). Sem parsing assíncrono do blob.

## Mudanças

### 1. Helper `getApiErrorMessage(err)` — novo `apps/web/src/lib/api-error.ts`

```ts
export function getApiErrorMessage(err: unknown): string {
  if (!err) return 'Erro inesperado';

  // 1. Erro HTTP (AxiosError) — extrair mensagem do backend
  const data = (err as { response?: { data?: { message?: unknown } } })
    .response?.data;
  if (data?.message) {
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.message)) return data.message.join(', ');
  }

  // 2. Erro de rede já convertido pelo interceptor (api.ts:24-27)
  if (err instanceof Error) return err.message;

  // 3. Fallback genérico
  return 'Ocorreu um erro inesperado';
}
```

- Cobre: string (`Insufficient stock...`), array Zod (`[...]` → junta com `, `),
  erro de rede (mensagem já bonita do interceptor `api.ts:24-27`), e fallback.
- **Ordem dos checks é crítica:** `AxiosError` é `instanceof Error`, então a
  extração de `response.data.message` deve vir ANTES do fallback `instanceof
  Error`; caso contrário, erros HTTP mostrariam a mensagem genérica do axios
  ("Request failed with status code 400") em vez da mensagem do backend.

### 2. Componente `ErrorBanner` — novo `apps/web/src/components/ui/error-banner.tsx`

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
        <button type="button" onClick={onDismiss} aria-label="Fechar" className="shrink-0 font-bold hover:text-red-800 dark:hover:text-red-300">
          ×
        </button>
      )}
    </div>
  );
}
```

- Mesmo estilo visual do banner inline já existente em `login.tsx:69-73`,
  `register.tsx:69-73`, `minibar-standard.tsx:188-192` (consistência de tema).
- `onDismiss` opcional (sem botão quando não necessário).

### 3. Aplicação nas páginas (híbrido)

**`apps/web/src/pages/app/stock-movements.tsx`** — `handleIn` (87),
`handleReplenish` (117), `handleMealOut` (146). Usam `mutateAsync`. Renderizar por
tab (o erro do React Query é por mutation):

```tsx
{createIn.isError && (
  <ErrorBanner
    message={getApiErrorMessage(createIn.error)}
    onDismiss={() => createIn.reset()}
  />
)}
```

Idem para `createReplenish` (tab rooms) e `createMealOut` (tab meals).

**`apps/web/src/pages/app/central-stock.tsx`** — `handleAdjust` (44). Usa
`updateMutation.mutateAsync`. Renderizar `ErrorBanner` dentro do `Dialog`
(dismissível). O `Dialog` só fecha em sucesso (comportamento atual já correto:
`setAdjustProduct(null)` após o await).

**`apps/web/src/pages/app/products.tsx`** — `onSubmit` (67) usa `api.patch` direto
(editar) e `createProduct.mutateAsync` (criar); `handleDelete` (77) usa
`deleteProduct.mutateAsync`.
- Erros do form (create): `createProduct.isError` → banner dentro do `Dialog`.
- Erros do edit (api.patch): try/catch + estado local `error` → banner dentro do
  `Dialog`, reset ao abrir o dialog.
- Erros do delete: `deleteProduct.isError` → banner no topo da página.

**`apps/web/src/pages/app/users.tsx`** — `onSubmit` (67) idêntico ao products
(edit via `api.patch`, create via `createUser.mutateAsync`); `handleDelete` (83)
via `deleteUser.mutateAsync`. Mesmo padrão.

### 4. Dashboard — erro nos downloads (mensagem genérica + logs no servidor)

`apps/web/src/hooks/use-download-report.ts` (37-43): manter o try/catch, mas usar
`getApiErrorMessage(err)` para montar a mensagem (que será genérica para erros
HTTP de download, pois o corpo é blob). `dashboard.tsx`:
- Destruturar `error` de cada hook (`useConsumptionByRoomCsv/Pdf`,
  `useMealRankingCsv/Pdf`, `useStockHistoryCsv/Pdf`).
- Renderizar um `ErrorBanner` (dismissível) por bloco de exportação quando
  `error` não for nulo.

**Logs no servidor (decisão):** `AllExceptionsFilter` (`apps/api/src/common/filters/all-exceptions.filter.ts`)
já loga `HttpException` (warn com o corpo) e erros não tratados (error com stack).
Nenhuma mudança no servidor necessária para esta etapa; documentar que a causa
raiz aparece nos logs do backend.

### 5. DRY — login/register/minibar-standard

- `login.tsx:44-51` e `register.tsx:49-56`: trocar extração inline por
  `getApiErrorMessage(err)` (resolve também o caso de mensagem array que hoje
  não é tratado).
- `minibar-standard.tsx:70-77`: usar `getApiErrorMessage`; `handleDelete` (85)
  troca `alert` por estado de erro + `ErrorBanner` no topo; banner do dialog
  passa a usar o componente `ErrorBanner`.

### 6. Testes

- `apps/web/src/lib/api-error.test.ts` (novo): string, array, `AxiosError` com
  `response.data.message`, erro de rede (`Error`), `null`/undefined, sem `message`.
- `apps/web/src/components/ui/error-banner.test.tsx` (novo): renderiza mensagem;
  `onDismiss` chamado no clique do botão; sem botão quando `onDismiss` ausente.

### 7. Verificação

- `pnpm --filter @nutrigest/web test`
- `pnpm lint`
- `pnpm build:web`

### 8. Commits (atômicos)

1. `feat: add getApiErrorMessage helper and ErrorBanner component`
2. `fix: show error banner on stock movements handlers`
3. `fix: show error banner on central stock adjust`
4. `fix: show error banner on products and users forms/deletes`
5. `fix: surface download errors on dashboard`
6. `refactor: use getApiErrorMessage across login, register and minibar`

## Riscos e mitigações

- **`AxiosError` é `instanceof Error`** — a ordem de checks do helper é crucial:
  extrair `response.data.message` ANTES do fallback `instanceof Error`; caso
  contrário, erros HTTP mostrariam mensagem genérica do axios. Coberto por teste.
- **Erros de download (blob)** — mensagem genérica para o usuário; causa raiz nos
  logs do servidor. Decisão consciente para evitar parsing async complexo.
- **Regressão de testes web** — `login.tsx`/`register.tsx` mudam a mensagem
  exibida em alguns casos de erro; verificar que os testes existentes (se houver
  para essas páginas) continuam passando. Não há testes de página hoje (apenas UI
  primitives), então risco baixo.

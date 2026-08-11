# Melhorias de Qualidade, Performance e Tratamento de Erros — Plano Mestre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir falhas críticas, moderadas e leves de boas práticas, performance e tratamento de erro no Nutrigest (API NestJS + Web React), priorizando segurança, visibilidade de erros para o usuário e integridade de dados.

**Architecture:** 6 etapas independentes, cada uma em uma branch própria (`fix/<nome>`), com TDD, lint, build e testes passando antes do merge em `dev`. Cada etapa é uma unidade testável isoladamente. A ordem prioriza: (1) segurança, (2) UX de erros, (3) integridade de estoque, (4) auth/refresh, (5) índices e dados, (6) ajustes leves.

**Tech Stack:** NestJS 11 + Fastify, Drizzle ORM + PostgreSQL, React 19 + Vite, React Query, Zod, Biome, pnpm workspaces, Jest (API), Vitest (Web).

---

## Estado Atual do Repositório (verificado em 2026-08-11)

- `dev` estava **atrasada em relação a `main`** (5 commits). Sincronizada via fast-forward (`9b75640..42fe390`).
- `dev` agora contém o fix `fix: add global api prefix to match frontend baseURL` (crítico para o frontend usar baseURL `/api`).
- Working tree limpo; branch de trabalho: `docs/improvements-plan` (este documento).
- Fluxo de aprovação: **o agente não faz merge**. Usuário testa manualmente → autoriza push + PR → usuário aprova e merge em `dev` manualmente.

---

## Fluxo de Git (repetir para CADA etapa)

1. Sincronizar: `git checkout dev && git pull`
2. Criar branch: `git checkout -b fix/<nome> dev`
3. Desenvolver com TDD e commits convencionais atômicos (`fix:`, `test:`, `refactor:`, `feat:`)
4. Verificar: `pnpm lint`, `pnpm build:api`, `pnpm build:web`, testes (API Jest + Web Vitest)
5. **Usuário testa manualmente**
6. Após autorização do usuário: `git push -u origin fix/<nome>` e abrir PR → `dev` (via `gh`)
7. **Usuário aprova e merge em `dev` manualmente** (o agente NÃO mergeia)
8. Após merge: sincronizar `dev` e avançar para a próxima etapa

---

## Progresso Geral

| Etapa | Branch | Problemas | Status |
|---|---|---|---|
| 1 | `fix/security-register-and-jwt` | Crítica 1 + Crítica 5 | ⬜ pendente |
| 2 | `fix/frontend-error-handling` | Crítica 2 | ⬜ pendente |
| 3 | `fix/stock-atomicity` | Crítica 3 | ⬜ pendente |
| 4 | `fix/auth-refresh-and-rate-limit` | Crítica 4 + Moderadas 6, 7, 8 | ⬜ pendente |
| 5 | `fix/db-indexes-and-data-integrity` | Moderadas 9, 10, 12, 14, 15 | ⬜ pendente |
| 6 | `fix/code-quality-polish` | Leves 16–22 | ⬜ pendente |

---

# Etapa 1 — Segurança: escalação de privilégio no registro + JWT_SECRET

**Branch:** `fix/security-register-and-jwt`

## Problema

**P1 (Crítica 1):** `POST /api/auth/register` é público e `RegisterSchema` aceita campo `role` opcional com default `OPERATOR` (`apps/api/src/auth/dto/register.dto.ts:8-11`). Qualquer anônimo pode enviar `{"role":"ADMIN"}` e criar uma conta de administrador. O frontend não envia `role`, mas a API aceita — vetor de escalação de privilégio.

**P2 (Crítica 5):** `JWT_SECRET` tem fallback `'dev-secret'` em dois lugares: `apps/api/src/auth/strategies/jwt.strategy.ts:20` e `apps/api/src/auth/auth.module.ts:12`. Em produção sem `JWT_SECRET` no ambiente, qualquer pessoa pode forjar tokens JWT (assinatura conhecida).

## Solução

**S1:** Remover `role` do schema de registro público. O `AuthService.register` passa a fixar `role: 'OPERATOR'` explicitamente no insert. Criação de usuários com outras roles permanece restrita ao endpoint admin `/users` (já protegido por `@Roles('ADMIN')`).

**S2:** Criar helper de configuração `apps/api/src/config/env.ts` que:
- Lê `JWT_SECRET`, `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGIN`, `PORT`, `UPLOAD_DIR`, `MAX_FILE_SIZE`.
- Lança erro na inicialização se `NODE_ENV === 'production'` e `JWT_SECRET` ausente, vazio ou igual a `'dev-secret'`.
- Exporta `JWT_SECRET` tipado para `auth.module.ts` e `jwt.strategy.ts` (remove os fallbacks inseguros).

## Arquivos

- Modify: `apps/api/src/auth/dto/register.dto.ts` — remove `role` do schema
- Modify: `apps/api/src/auth/auth.service.ts` — fixa `role: 'OPERATOR'` no insert
- Create: `apps/api/src/config/env.ts` — validação e leitura de variáveis de ambiente
- Modify: `apps/api/src/auth/auth.module.ts` — usa `JWT_SECRET` do config
- Modify: `apps/api/src/auth/strategies/jwt.strategy.ts` — usa `JWT_SECRET` do config
- Test: `apps/api/src/auth/auth.service.spec.ts` — registro fixa role
- Test: `apps/api/test/auth.e2e-spec.ts` — registro não aceita role; ADMIN criado via `/users`
- Test: `apps/api/src/config/env.spec.ts` — falha se JWT_SECRET ausente em produção

## Passos de execução

- [ ] **Passo 1 — TDD:** escrever teste que registra usuário enviando `role: 'ADMIN'` e espera `OPERATOR` no retorno; e teste unitário de `validateEnv()` que lança quando `NODE_ENV=production` e `JWT_SECRET` inseguro. Rodar e ver falhar.
- [ ] **Passo 2 — Implementar:** remover `role` do `RegisterSchema`; fixar `role: 'OPERATOR'` em `auth.service.ts`; criar `config/env.ts`.
- [ ] **Passo 3 — Implementar:** trocar fallbacks de `JWT_SECRET` por valor validado do config em `auth.module.ts` e `jwt.strategy.ts`.
- [ ] **Passo 4 — Verificar:** `pnpm --filter @nutrigest/api test`, `pnpm --filter @nutrigest/api test:e2e`, `pnpm lint`, `pnpm build:api`.
- [ ] **Passo 5 — Commit:** commits atômicos separando `test:`, `fix:` (register) e `fix:` (jwt secret).
- [ ] **Passo 6 — Usuário testa manualmente; autoriza push + PR.**

---

# Etapa 2 — Tratamento de erros no frontend ("nada aparece")

**Branch:** `fix/frontend-error-handling`

## Problema

**Crítica 2:** Chamadas com `mutateAsync` **sem try/catch** em vários handlers fazem a promise rejeitar silenciosamente quando a API retorna erro (ex.: estoque insuficiente → `400 Insufficient stock`). O usuário não vê nenhuma mensagem. Ocorre em:

- `apps/web/src/pages/app/stock-movements.tsx` — `handleIn` (linha 93), `handleReplenish` (linha 133), `handleMealOut` (linha 149)
- `apps/web/src/pages/app/central-stock.tsx` — `handleAdjust` (linha 46)
- `apps/web/src/pages/app/products.tsx` — `onSubmit` (linha 69), `handleDelete` (linha 79)
- `apps/web/src/pages/app/users.tsx` — `onSubmit` (linha 75), `handleDelete` (linha 85)

Além disso: `use-download-report.ts` captura erro e seta estado, mas **o dashboard nunca renderiza esse erro** (`dashboard.tsx` só usa `isDownloading`).

## Solução

Criar um helper único de extração de mensagem de erro e um banner de erro reutilizável, e aplicar em todas as pages afetadas:

1. **Helper `getApiErrorMessage(err)`** em `apps/web/src/lib/api-error.ts` — extrai `err.response.data.message` (string ou array de Zod), com fallbacks para erros de rede (`Servidor indisponível...`) e mensagem genérica.
2. **Componente `ErrorBanner`** em `apps/web/src/components/ui/error-banner.tsx` — banner vermelho reutilizável (padrão já usado em login/register).
3. Aplicar nas pages: estado `error` + `try/catch` nos handlers, exibindo `ErrorBanner`. Resetar erro ao iniciar nova operação/troca de tab.
4. **Dashboard:** renderizar o `error` de `useDownloadReport` (consumption/ranking/history).
5. Extrair o padrão de "mensagem de erro" que já existe em `login.tsx`, `register.tsx`, `minibar-standard.tsx` para usar o mesmo helper (DRY).

## Arquivos

- Create: `apps/web/src/lib/api-error.ts`
- Create: `apps/web/src/components/ui/error-banner.tsx`
- Modify: `apps/web/src/pages/app/stock-movements.tsx`
- Modify: `apps/web/src/pages/app/central-stock.tsx`
- Modify: `apps/web/src/pages/app/products.tsx`
- Modify: `apps/web/src/pages/app/users.tsx`
- Modify: `apps/web/src/pages/app/dashboard.tsx`
- Modify: `apps/web/src/pages/auth/login.tsx`, `register.tsx`, `apps/web/src/pages/app/minibar-standard.tsx` (reusar helper)
- Test: `apps/web/src/lib/api-error.test.ts`
- Test: `apps/web/src/components/ui/error-banner.test.tsx`

## Passos de execução

- [ ] **Passo 1 — TDD:** escrever testes para `getApiErrorMessage` (string, array, sem resposta, rede) e `ErrorBanner` (renderiza mensagem). Rodar e ver falhar.
- [ ] **Passo 2 — Implementar:** criar helper + componente.
- [ ] **Passo 3 — Aplicar:** adicionar estado de erro + try/catch em `stock-movements.tsx` (IN/Replenish/Meal), `central-stock.tsx`, `products.tsx`, `users.tsx`; renderizar `ErrorBanner`.
- [ ] **Passo 4 — Dashboard:** exibir erro de download dos relatórios.
- [ ] **Passo 5 — Verificar:** `pnpm --filter @nutrigest/web test`, `pnpm lint`, `pnpm build:web`.
- [ ] **Passo 6 — Commit:** commits atômicos (`feat:` helper/component, `fix:` por página).
- [ ] **Passo 7 — Usuário testa manualmente; autoriza push + PR.**

---

# Etapa 3 — Integridade do estoque (atomicidade / race condition)

**Branch:** `fix/stock-atomicity`

## Problema

**Crítica 3:** Atualizações de estoque usam padrão read-then-write não atômico:

- `upsertCentralStock` (`apps/api/src/stock-movements/stock-movements.service.ts:216-232`) faz `SELECT` da quantidade e depois `INSERT ... ON CONFLICT DO UPDATE` com o valor **já calculado**. Duas requisições concorrentes podem ler a mesma quantidade e ambas gravar, causando **perda de atualização** (ex.: estoque negativo ou subestimado).
- `createReplenish` (`stock-movements.service.ts:67-77`) verifica saldo via `getQuantity` **fora** da transação. Entre a checagem e o insert pode ocorrer outra operação → **oversell**.
- `CentralStockService.increment/decrement` (`apps/api/src/central-stock/central-stock.service.ts:106-154`) tem o mesmo padrão read-then-write não atômico.

## Solução

Usar **incremento atômico no banco** em vez de ler-calcular-gravar:

1. `upsertCentralStock`: no `ON CONFLICT DO UPDATE`, usar `sql`${centralStock.quantity} + ${delta}`` para incrementar atomicamente (o Postgres aplica sobre o valor mais recente após resolução de conflito de lock).
2. `createReplenish`: mover a checagem de saldo **para dentro da transação**, com `SELECT ... FOR UPDATE` (lock da linha de estoque) antes de decidir; se insuficiente, lançar `BadRequestException` (faz rollback da transação). Manter mensagem clara com disponível vs. requerido.
3. `CentralStockService.increment/decrement`: usar incremento atômico; `decrement` valida saldo com `SELECT ... FOR UPDATE` dentro de transação (ou condicional `WHERE quantity >= amount` e checar rows affected).
4. Tratar erro de constraint/validação para evitar estoque negativo persistido.

## Arquivos

- Modify: `apps/api/src/stock-movements/stock-movements.service.ts`
- Modify: `apps/api/src/central-stock/central-stock.service.ts`
- Test: `apps/api/src/stock-movements/stock-movements.service.spec.ts` — teste de concorrência (ex.: `Promise.all` de N replenishes) e de saldo insuficiente dentro da transação
- Test: `apps/api/src/central-stock/central-stock.service.spec.ts`
- Test: `apps/api/test/stock-movements.e2e-spec.ts` — repetir replenish até zerar; verificar `400` no excedente

## Passos de execução

- [ ] **Passo 1 — TDD:** escrever testes de concorrência/saldo insuficiente (replicar race). Rodar e ver falhar (ou documentar o comportamento atual).
- [ ] **Passo 2 — Implementar:** incremento atômico via `sql` em `upsertCentralStock`.
- [ ] **Passo 3 — Implementar:** checagem de saldo dentro da transação com `SELECT ... FOR UPDATE` em `createReplenish`.
- [ ] **Passo 4 — Implementar:** `increment`/`decrement` atômicos no `CentralStockService`.
- [ ] **Passo 5 — Verificar:** `pnpm --filter @nutrigest/api test`, `pnpm --filter @nutrigest/api test:e2e`, `pnpm lint`, `pnpm build:api`.
- [ ] **Passo 6 — Commit:** commits atômicos por serviço.
- [ ] **Passo 7 — Usuário testa manualmente; autoriza push + PR.**

---

# Etapa 4 — Auth: refresh O(n), silent refresh no front, rate limiting, forgot-password

**Branch:** `fix/auth-refresh-and-rate-limit`

## Problema

**Crítica 4:** `AuthService.refresh` (`apps/api/src/auth/auth.service.ts:258-276`) e `resetPassword` (linhas 218-241) carregam **todas** as linhas de `refresh_tokens`/`password_reset_tokens` e fazem `bcrypt.compare` uma a uma (~100ms cada). O(n) bcrypt a cada request → lentidão crescente e vetor de DoS conforme a tabela cresce.

**Moderada 6:** O frontend **nunca usa** o endpoint `/auth/refresh` — o interceptor (`apps/web/src/lib/api.ts:16-30`) apenas limpa tokens e redireciona para `/login` em qualquer 401. Sessão cai a cada 15min (expiração do access token).

**Moderada 7:** Sem rate limiting nos endpoints públicos de auth (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/refresh`) → força bruta e enumeração de contas. Sem Helmet (headers de segurança) no bootstrap.

**Moderada 8:** `forgotPassword` (`auth.service.ts:215`) retorna o `resetToken` **na resposta da API** em vez de enviar por e-mail, e `resetPassword` não vincula o token ao e-mail. Com rate limit ausente, isso permite resetar senha de qualquer conta via brute force.

## Solução

**S4 (token lookup O(1)):** Armazenar o hash do token em coluna indexada e consultar direto. Como `refreshTokens.tokenHash` hoje guarda bcrypt (não indexável por lookup), a abordagem compatível:
- Opção A (recomendada): manter bcrypt, mas adicionar índice em `userId` + filtrar por `userId`/`expiresAt` antes de comparar — reduz drasticamente o conjunto a comparar. Para `resetPassword`, vincular o token ao e-mail no DTO (buscar tokens do usuário específico).
- Adicionar job/limpeza de tokens expirados (opcional nesta etapa; ao menos filtrar `gt(expiresAt, now)` já existe — refinar).

**S6 (silent refresh):** No interceptor do axios (`apps/web/src/lib/api.ts`): ao receber 401 (exceto em `/auth/login` e `/auth/refresh`), tentar `POST /auth/refresh` com `refreshToken`, atualizar tokens em `localStorage`, reenviar a requisição original; usar fila de requisições pendentes durante o refresh (uma única chamada de refresh); falhar → logout.

**S7 (rate limit + headers):** Adicionar `@nestjs/throttler` com config (ex.: 5 req/min em `/auth/*` públicos; limites maiores nas rotas autenticadas). Adicionar `helmet` no bootstrap (`main.ts`).

**S8 (forgot-password):** Como não há infraestrutura de e-mail no projeto, mitigar o risco:
- Não retornar o token no corpo da resposta (retornar mensagem neutra).
- Adicionar rate limit específico para `/auth/forgot-password` e `/auth/reset-password` (ex.: 3/hora por e-mail).
- Vincular e-mail ao `resetPassword` (DTO ganha `email`; busca tokens do usuário daquele e-mail).
- **Decidir durante o brainstorm da etapa** se o token vai para um log/e-mail futuro ou fluxo de link — documentar a decisão.

## Arquivos

- Modify: `apps/api/src/auth/auth.service.ts` — refresh/reset mais eficientes; resetPassword com email
- Modify: `apps/api/src/auth/dto/reset-password.dto.ts` — adiciona `email`
- Modify: `apps/api/src/auth/dto/forgot-password.dto.ts` — se aplicável
- Create: `apps/api/src/auth/throttler.config.ts` (ou inline no module)
- Modify: `apps/api/src/auth/auth.module.ts` — importa `ThrottlerModule`
- Modify: `apps/api/src/main.ts` — `app.use(helmet())`
- Modify: `apps/api/package.json` — novas deps (`@nestjs/throttler`, `helmet`)
- Modify: `apps/web/src/lib/api.ts` — silent refresh + fila
- Modify: `apps/web/src/contexts/auth-context.tsx` — expor refresh/estado
- Test: `apps/api/src/auth/auth.service.spec.ts` (lookup por email/user)
- Test: `apps/api/test/auth.e2e-spec.ts` (rate limit 429; reset com email)
- Test: `apps/web/src/lib/api.test.ts` (interceptor refresh)

## Passos de execução

- [ ] **Passo 1 — TDD:** testes para refresh/reset com filtro por user/email; e2e de rate limit (429). Ver falhar.
- [ ] **Passo 2 — Implementar:** eficiência do refresh/reset (filtro por usuário/e-mail); DTO com e-mail.
- [ ] **Passo 3 — Implementar:** ThrottlerModule + helmet; config de limites.
- [ ] **Passo 4 — Implementar:** silent refresh no interceptor (com fila de pendentes).
- [ ] **Passo 5 — Verificar:** `pnpm lint`, `pnpm build:api`, `pnpm build:web`, testes API + Web.
- [ ] **Passo 6 — Commit:** atômicos (`fix:` per token, `feat:` throttler, `feat:` silent refresh).
- [ ] **Passo 7 — Usuário testa manualmente (sessão > 15min sem logout); autoriza push + PR.**

---

# Etapa 5 — Índices, count no summary, CSV injection, deletes amigáveis, senha atual no perfil

**Branch:** `fix/db-indexes-and-data-integrity`

## Problema

**Moderada 9 — Sem índices:** `stock_movements` (type, productId, room, createdAt) sem índices → seq scan em todas as queries de dashboard/filtros. `refresh_tokens.userId`, `password_reset_tokens.userId` também sem índice (a etapa 4 depende disso).

**Moderada 10 — CSV injection:** `toCsv` (`apps/api/src/dashboard/dashboard.service.ts:186-204`) não escapa valores que começam com `=`, `+`, `-`, `@` → fórmulas maliciosas executadas no Excel.

**Moderada 12 — Summary carrega tudo:** `getSummary` (`dashboard.service.ts:23-24`) usa `productsService.findAll()` só para fazer `.length`. Deve ser `count(*)`.

**Moderada 14 — FK violations em delete → 500:** `stock_movements.userId/productId` sem `onDelete` (`apps/api/src/db/schema/stock-movements.ts:22-29`). Deletar usuário/produto com histórico lança FK violation → 500 genérico. Deletar usuário também não protege "deletar a si mesmo".

**Moderada 15 — Troca de senha sem verificar senha atual:** `updateProfile` (`auth.service.ts:124-172`) altera senha sem validar `currentPassword`. O frontend (`profile.tsx:63`) envia `currentPassword`, mas o DTO (`update-profile.dto.ts`) e o service ignoram.

## Solução

**S9:** Criar migração Drizzle adicionando índices em `stock_movements` (`type`, `productId`, `room`, `createdAt`), `refresh_tokens.userId`, `password_reset_tokens.userId`.

**S10:** Sanitizar valores de CSV iniciando com `=`, `+`, `-`, `@`, prefixando com `'` (ou strip), além do escape existente.

**S12:** Trocar `findAll().length` por `count(*)` via `sql` em `getSummary`.

**S14:** Tratar deletes com dependências: checar se há movimentações/stock antes de excluir e lançar `BadRequestException` com mensagem clara (ou adicionar `onDelete` + soft-delete — **decidir no brainstorm**). Impedir usuário de se auto-deletar (`users.service.remove`).
- Melhoria de robustez: no `AllExceptionsFilter`, detectar FK violation do Postgres (código `23503`) e retornar `409 Conflict` amigável.

**S15:** `UpdateProfileDto` ganha `currentPassword` (opcional, obrigatório se `password` presente); `updateProfile` valida com `bcrypt.compare` antes de trocar a senha.

## Arquivos

- Create: `apps/api/drizzle/000X_*.sql` (migração de índices)
- Modify: `apps/api/src/dashboard/dashboard.service.ts` (toCsv sanitize + count)
- Modify: `apps/api/src/users/users.service.ts` (auto-delete + deletes com dependência)
- Modify: `apps/api/src/products/products.service.ts` (delete com dependência)
- Modify: `apps/api/src/auth/dto/update-profile.dto.ts` + `auth.service.ts` (currentPassword)
- Modify: `apps/api/src/common/filters/all-exceptions.filter.ts` (23503 → 409)
- Test: `apps/api/src/dashboard/dashboard.service.spec.ts` (csv injection, count)
- Test: `apps/api/src/users/users.service.spec.ts`, `apps/api/src/products/products.service.spec.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts` (senha errada bloqueia troca)

## Passos de execução

- [ ] **Passo 1 — TDD:** testes de CSV injection, count, auto-delete, senha atual errada. Ver falhar.
- [ ] **Passo 2 — Implementar:** sanitize CSV + count no summary.
- [ ] **Passo 3 — Implementar:** validação de currentPassword no perfil.
- [ ] **Passo 4 — Implementar:** deletes com dependência + proteção de auto-delete + filtro 23503.
- [ ] **Passo 5 — Implementar:** migração de índices (`drizzle-kit generate` + aplicar em `dev` e `test`).
- [ ] **Passo 6 — Verificar:** `pnpm lint`, `pnpm build:api`, testes API + e2e (migração no banco de teste).
- [ ] **Passo 7 — Commit:** atômicos por tema.
- [ ] **Passo 8 — Usuário testa manualmente; autoriza push + PR.**

---

# Etapa 6 — Ajustes leves de qualidade e performance

**Branch:** `fix/code-quality-polish`

## Problemas

**Leve 16 — Queries redundantes:** `ensureProductExists` faz 1 query por item fora da transação + insert/upsert por item dentro (`stock-movements.service.ts:28-30, 67-77`). Pode ser batch (uma query `IN` + multi-row insert).

**Leve 17 — Imagens quebradas em dev:** `vite.config.ts` só faz proxy de `/api`; `imageUrl` é `/uploads/...` servido pela API → 404 em dev. Adicionar proxy `/uploads`.

**Leve 18 — Constantes duplicadas:** `VALID_ROOMS` duplicado em `stock-movements.service.ts` e `minibar-standard.service.ts`; threshold `5` hardcoded no dashboard. Extrair para `packages/shared` ou `apps/api/src/common/constants.ts`.

**Leve 19 — Sem guarda de rota no frontend:** `/app/*` renderiza layout vazio sem usuário (API rejeita, mas UX ruim). Adicionar `ProtectedRoute` em `routes.tsx` redirecionando para `/login`.

**Leve 20 — `as any` no Drizzle:** joins usam `as any` (`stock-movements.service.ts:192-194`, etc.). Migrar para relational queries do Drizzle (tipagem correta) onde viável.

**Leve 21 — `recentMeals` client-side:** `stock-movements.tsx:165-167` filtra `MEAL_OUT` dos 20 movimentos já paginados. Melhor usar a API com `?type=MEAL_OUT&limit=5`.

**Leve 22 — Duplicação de extração de erro:** refatorar para usar `getApiErrorMessage` criado na Etapa 2.

## Solução

- **16:** Batch de validação de produtos (query única com `IN`) e multi-row insert nas movimentações.
- **17:** Adicionar `'/uploads'` ao `server.proxy` do Vite apontando para `http://localhost:3000`.
- **18:** Extrair `VALID_ROOMS` e threshold de estoque baixo para constantes compartilhadas; usar nos dois services e no dashboard.
- **19:** Criar `ProtectedRoute` (redireciona para `/login` se não autenticado) e envolver as rotas `/app`.
- **20:** Usar relational queries (`db.query.stockMovements.findMany({ with: { product, user } })`) onde o Drizzle oferecer; remover `as any`.
- **21:** Usar hook de movimentações com filtro `type: 'MEAL_OUT', limit: 5` no servidor.
- **22:** Trocar padrões duplicados por `getApiErrorMessage` (refactor pós-Etapa 2).

## Arquivos

- Modify: `apps/api/src/stock-movements/stock-movements.service.ts` (batch, constants, relational)
- Modify: `apps/api/src/minibar-standard/minibar-standard.service.ts` (constants)
- Modify: `apps/api/src/dashboard/dashboard.service.ts` (threshold)
- Create/Modify: `apps/api/src/common/constants.ts`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/components/layout/protected-route.tsx` (ou equivalente)
- Modify: `apps/web/src/routes.tsx`
- Modify: `apps/web/src/pages/app/stock-movements.tsx` (recentMeals server-side)
- Modify: `apps/web/src/hooks/queries/use-movement-queries.ts`

## Passos de execução

- [ ] **Passo 1 — Constantes compartilhadas:** extrair `VALID_ROOMS` + threshold; usar nos 3 services.
- [ ] **Passo 2 — Proxy /uploads** no Vite; verificar imagem de produto em dev.
- [ ] **Passo 3 — ProtectedRoute** nas rotas `/app`.
- [ ] **Passo 4 — Batch queries** no createIn/createReplenish.
- [ ] **Passo 5 — recentMeals server-side.**
- [ ] **Passo 6 — Relational queries** (remover `as any`) — apenas onde o retorno dos testes e2e não muda.
- [ ] **Passo 7 — Verificar:** `pnpm lint`, `pnpm build:api`, `pnpm build:web`, testes.
- [ ] **Passo 8 — Commit:** atômicos por tema.
- [ ] **Passo 9 — Usuário testa manualmente; autoriza push + PR.**

---

## Decisões em aberto (resolver no brainstorm de cada etapa)

- **Etapa 4:** formato do reset token (e-mail/log) — não há infra de e-mail hoje.
- **Etapa 5:** deletes com dependência — soft-delete vs. checagem prévia com mensagem amigável.
- **Etapa 5:** adicionar job de limpeza de tokens expirados? (pode ir para o TODO futuro).

## Após a Etapa 6 (fora do escopo desta leva)

- Audit logs (já listado em `docs/TODO.md`).
- Monitoramento/observabilidade, CI automatizado com lint+build+test (hoje manual).

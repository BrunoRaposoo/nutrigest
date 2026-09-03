# CI GitHub Actions — Nutrigest — Design

> Aprovado em 2026-09-03. Brainstorm com usuário escolheu: scope A (sem e2e, só lint+build+unit), triggers A (todo push + todo PR qualquer branch), estrutura A (paralelo + required). Abordagem 1 (single workflow paralelo).

## Objetivo
Garantir que todo `push` e `pull_request` (qualquer branch) rode verificações rápidas (<3min) e bloqueie merge se falhar, adaptado ao monorepo pnpm (`apps/api` Jest, `apps/web` Vitest, `biome`, `pnpm build`).

## Escopo
- **In**: `biome ci`, `pnpm build:api`, `pnpm build:web`, `pnpm --filter @nutrigest/api test` (unit), `pnpm --filter @nutrigest/web test` (unit)
- **Out**: `test:e2e` (precisa Postgres service, fica local/manual antes de deploy Neon), deploy automático (manual Render/Vercel), Docker build check (opcional futuro)

## Arquitetura

### Workflow
```yaml
name: CI
on: { push: {}, pull_request: {} }
concurrency: { group: ci-${{github.ref}}, cancel-in-progress: true }
jobs: lint, build-api, build-web, test-api, test-web (paralelos)
```

### Jobs

| Job | Runner | Steps | Fail fast |
|-----|--------|-------|-----------|
| **lint** | ubuntu-latest | checkout → pnpm/action-setup@9 → setup-node@24 cache:pnpm → pnpm install --frozen-lockfile → pnpm lint:ci | blocks PR |
| **build-api** | ubuntu-latest | same setup → pnpm build:api (shared+api) | blocks |
| **build-web** | ubuntu-latest | same setup → pnpm build:web (tsc -b && vite) | blocks |
| **test-api** | ubuntu-latest | same setup → pnpm --filter @nutrigest/api test (Jest, --runInBand, 30s timeout) | blocks |
| **test-web** | ubuntu-latest | same setup → pnpm --filter @nutrigest/web test (Vitest run, jsdom) | blocks |

Todos usam `pnpm/action-setup@v4` + `actions/setup-node@v4` com `cache: 'pnpm'` (oficial Context7, requer pnpm >=6.10, projeto usa 9). Node 24 alinha com `Dockerfile FROM node:24-alpine`. `pnpm install --frozen-lockfile` garante reprodutível.

### Env vars para tests
Unit não precisa DB, mas `apps/api/src/config/env.spec.ts` valida `JWT_SECRET`. Workflow injeta `JWT_SECRET=test-secret-for-ci-32-chars-minimum-xyz123` e `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy` para casos que importam `DbService` mockado (não conecta). Para `test-web`, `VITE_API_URL` dummy.

### Branch protection (pós-workflow)
GitHub Settings → Branches → Add rule `main`, `dev`: Require status checks → select 5 jobs → Require branches up to date → Include administrators optional. Sem essa regra, checks são informativos.

## Fluxo
1. Dev `git push` em `feat/x` → workflow dispara → 5 jobs paralelos → se lint falha, PR mostra ❌
2. Abre PR `feat/x → dev` → mesmo workflow em `pull_request` → required checks bloqueiam merge
3. Merge para `dev` → push em `dev` dispara de novo (valida integração)
4. Local `pnpm lint && pnpm test && pnpm build:api/build:web` deve passar antes de push para evitar CI falho

## Alternativas descartadas
- **Dois workflows**: duplica manutenção
- **Matrix + reutilizável**: overkill para 5 jobs
- **Service Postgres + e2e**: lento, você escolheu não incluir (correto para feedback rápido)

## Riscos
- **Cache poison**: `cache: pnpm` usa hash `pnpm-lock.yaml`, seguro
- **Minutos**: 5 jobs paralelos consomem 5x minutos mas duração wall é ~2min vs 4min sequencial; para hobby GitHub 2000 min/mês, 50 pushes/mês ×2min×5 = 500 min, ok
- **Flaky web build**: já corrigido `protected-route.test.tsx` (register removido) + `vite/client` types

## Métricas de sucesso
- CI verde em <3min para PR limpo
- 0 pushes com `biome ci` falho após 1 semana
- Branch protection ativa em `main`/`dev`

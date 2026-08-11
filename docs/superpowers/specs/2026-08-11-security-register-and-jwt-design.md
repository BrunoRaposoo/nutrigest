# Design — Etapa 1: Segurança (escalação de privilégio + JWT_SECRET)

Data: 2026-08-11
Branch: `fix/security-register-and-jwt`
Origem: `dev` (`9ce2e40`)
Plano mestre: `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`

## Objetivo

Corrigir duas críticas de segurança:

1. **Crítica 1** — `POST /auth/register` aceita `role` no corpo, permitindo que
   qualquer pessoa se registre como `ADMIN` ou `TECHNICIAN` (escalação de
   privilégio).
2. **Crítica 5** — `JWT_SECRET` tem fallback hardcoded `'dev-secret'`
   (`auth.module.ts:12`, `jwt.strategy.ts:20`); produção pode rodar com segredo
   conhecido/fracos.

## Decisões (aprovadas pelo usuário)

- **Testes e2e**: novo helper de banco compartilhado
  `apps/api/test/helpers/auth.helper.ts` que insere usuário com `role` desejado
  diretamente via `DbService` + login via endpoint, em vez de abusar do
  `/auth/register` com `role` (que será removido). Refatorar os 6 e2e specs.
- **Config de ambiente**: novo módulo leve `apps/api/src/config/env.ts` que
  valida `JWT_SECRET` — em produção, ausente/vazio/`dev-secret`/curto → throw na
  inicialização; em dev/test, mantém fallback `'dev-secret'`. Sem nova
  dependência (sem `@nestjs/config`). YAGNI: Etapa 1 só centraliza `JWT_SECRET`;
  demais variáveis continuam via `process.env`.

## Mudanças

### 1. Bloquear escalação no registro

`apps/api/src/auth/dto/register.dto.ts`:
- Remover `role` de `RegisterSchema`.
- Manter o DTO restante (`name`, `email`, `password`).
- `RegisterData` deixa de ter `role`.

`apps/api/src/auth/auth.service.ts`:
- `register()` passa a gravar `role: 'OPERATOR'` fixo (sem ler `dto.role`).
- `RegisterData` continua usado como tipo do parâmetro; `dto.role` some.

Observação: o Zod, por padrão, **descarta** campos desconhecidos (modo não
strict), então mesmo que um cliente envie `role: 'ADMIN'`, ele será ignorado e o
usuário será criado como `OPERATOR`.

### 2. Validação centralizada do JWT_SECRET

Novo `apps/api/src/config/env.ts`:

```ts
export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (!secret || secret === 'dev-secret' || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a strong secret in production');
  }
  return secret ?? 'dev-secret';
})();
```

Aplicar:
- `apps/api/src/auth/auth.module.ts:12` → `secret: JWT_SECRET`
- `apps/api/src/auth/strategies/jwt.strategy.ts:20` → `secretOrKey: JWT_SECRET`

Observações:
- Em testes, `.env.test` define `JWT_SECRET=test-secret` e `NODE_ENV` não é
  `production`, então o fallback não lança.
- `JWT_REFRESH_SECRET` existe em `.env*` mas não é usado no código — fora do
  escopo desta etapa (anotado no plano mestre).

### 3. Helper de teste e2e compartilhado

Novo `apps/api/test/helpers/auth.helper.ts`:

```ts
import * as bcrypt from 'bcrypt';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DbService } from '../../src/db/db.service';
import { users } from '../../src/db/schema';

export type TestRole = 'ADMIN' | 'TECHNICIAN' | 'OPERATOR';

export async function createUserWithRole(
  app: NestFastifyApplication,
  role: TestRole,
) {
  const db = app.get(DbService);
  const email = `e2e-${role}-${Date.now()}-${Math.random()}@example.com`;
  const password = 'password123';

  const [user] = await db.db
    .insert(users)
    .values({
      name: `${role} User`,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    })
    .returning({ id: users.id, email: users.email, role: users.role });

  return { user, email, password };
}

export async function registerAndLogin(
  app: NestFastifyApplication,
  role: TestRole = 'OPERATOR',
) {
  const { email, password } = await createUserWithRole(app, role);

  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });

  return JSON.parse(loginRes.body) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: TestRole };
  };
}
```

Refatorar os 6 specs para usar `registerAndLogin(app, role)` no lugar do helper
local duplicado `registerAndLogin` (que dependia do `role` no `/auth/register`):
- `apps/api/test/users.e2e-spec.ts`
- `apps/api/test/dashboard.e2e-spec.ts`
- `apps/api/test/products.e2e-spec.ts`
- `apps/api/test/central-stock.e2e-spec.ts`
- `apps/api/test/minibar-standard.e2e-spec.ts`
- `apps/api/test/stock-movements.e2e-spec.ts`

Em cada spec, no `beforeAll` (após `app` criado), obter `db` via
`app.get(DbService)`, e remover o `registerAndLogin` local.

### 4. Testes novos/ajustados

**Unit `apps/api/src/config/env.spec.ts` (novo):**
- `JWT_SECRET` lança se `NODE_ENV=production` e `JWT_SECRET` ausente.
- Lança se `NODE_ENV=production` e `JWT_SECRET === 'dev-secret'`.
- Lança se `NODE_ENV=production` e `JWT_SECRET` curto (< 32).
- Não lança em dev/test sem `JWT_SECRET` (retorna `'dev-secret'`).
- Não lança em produção com segredo forte.

Nota: como `JWT_SECRET` é avaliado no import do módulo, os testes devem
manipular `process.env` e re-importar o módulo com `jest.resetModules()` +
`require` para isolar cada caso.

**Unit `apps/api/src/auth/auth.service.spec.ts`:**
- Remover `role: 'OPERATOR'` da chamada em `register` (linha ~40).
- Adicionar teste: `register` sempre retorna `role: 'OPERATOR'`.

**E2E `apps/api/test/auth.e2e-spec.ts`:**
- Novo teste: `POST /auth/register` com `role: 'ADMIN'` no payload → `201`,
  `body.role === 'OPERATOR'`.

### 5. Verificação

- `pnpm lint`
- `pnpm build:api`
- `pnpm --filter @nutrigest/api test` (unit, com postgres em docker)
- `pnpm --filter @nutrigest/api test:e2e`

## Commits (atômicos)

1. `test: add env validation and register role enforcement tests`
2. `fix: remove role from public register DTO and force OPERATOR`
3. `fix: validate JWT_SECRET in production via config/env`
4. `test: refactor e2e specs to use shared auth helper`

## Riscos e mitigações

- **Testes quebrados nos 6 e2e specs** — o helper compartilhado preserva o
  comportamento de RBAC (cria usuário real com role), então a regressão deve ser
  nula; validar com `test:e2e` completo.
- **Ambiente local sem `JWT_SECRET`** — fallback `'dev-secret'` preservado para
  dev/test; apenas produção é bloqueada.

# Design — Auth: refresh O(1), silent refresh, rate limit + helmet, forgot/reset seguros

**Branch:** `fix/auth-refresh-and-rate-limit`
**Relação:** Etapa 4 do plano mestre `docs/superpowers/plans/2026-08-11-code-quality-improvements.md`
**Data:** 2026-08-12

## Problema

**Crítica 4:** `AuthService.refresh` (`apps/api/src/auth/auth.service.ts:258-276`) e `resetPassword` (218-241) carregam **todas** as linhas válidas de `refresh_tokens`/`password_reset_tokens` e executam `bcrypt.compare` uma a uma (~100ms cada). Conforme as tabelas crescem, cada request fica cada vez mais lento e vira vetor de DoS (N bcrypt por request).

**Moderada 6:** O frontend nunca usa `/auth/refresh`. O interceptor (`apps/web/src/lib/api.ts:16-30`) limpa tokens e redireciona para `/login` em **qualquer** 401 → a sessão cai a cada 15min (expiração do access token).

**Moderada 7:** Não há rate limiting nos endpoints públicos de auth (login, register, forgot-password, reset-password, refresh) → força bruta e enumeração de contas. Não há Helmet (headers de segurança).

**Moderada 8:** `forgotPassword` retorna o `resetToken` na resposta da API (215) em vez de e-mail; `resetPassword` não vincula o token ao e-mail → com rate limit ausente, permite resetar senha de qualquer conta via brute force.

## Solução

### S4 — Token lookup O(1) com digest sha256 indexado

Substituir o bcrypt-compare sobre todas as linhas por lookup direto via digest.

**Decisão de design (aprovada pelo usuário):** coluna `tokenDigest` contendo `sha256(token)` em hex + índice único; lookup por igualdade → **O(1)**. O token bruto tem 48 bytes aleatórios (384 bits de entropia); hash criptográfico rápido é suficiente — bcrypt permanece apenas para senhas.

- **Esquema:**
  - `refresh_tokens`: drop `tokenHash`, add `tokenDigest varchar(64) notNull` + índice único.
  - `password_reset_tokens`: drop `tokenHash`, add `tokenDigest varchar(64) notNull` + índice único.
  - Migração invalida tokens existentes (DELETE antes de add constraint/index) — bcrypt é irreversível, não há como recomputar digest. Força re-login / re-solicitação de reset **uma única vez**. Aceito.
- **Geração de tokens:** `generateTokens` e `forgotPassword` passam a gravar `tokenDigest: sha256(rawToken)` em vez de `bcrypt.hash(rawToken)`. Fim do bcrypt nos fluxos de token.
- **`AuthService.refresh`:** lookup O(1):
  ```ts
  where(and(eq(refreshTokens.tokenDigest, sha256(dto.refreshToken)), gt(refreshTokens.expiresAt, new Date())))
  ```
  Mantém rotação (delete do token usado + gera novo) e reuse detection (segunda chamada não encontra o token deletado → 401).
- **`AuthService.resetPassword`:** DTO ganha `email`. Fluxo: busca `user` por `email` (se não existir, lança o mesmo 400 genérico — sem 404, para não expor se o e-mail existe); lookup no token por `AND(tokenDigest = sha256(dto.token), userId = user.id, expiresAt > now, usedAt IS NULL)`. Sem loop O(n); token vinculado ao e-mail → brute force inviabilizado mesmo com token vazado.
- **`AuthService.forgotPassword`:** grava digest; deleta quaisquer `password_reset_tokens` anteriores não-usurados do usuário antes de inserir (evita acúmulo). Retorna `{ resetToken }` **apenas quando `NODE_ENV !== 'production'`**; em produção retorna `{ message: 'If that email exists, a reset token has been generated' }` (mensagem neutra já existente).

### S7 — Rate limit por rota via @nestjs/throttler + Helmet

**Decisão de design (aprovada):** limites por rota via `@Throttle`; guard desabilitado em test; verificação de 429 isolada em e2e próprio com throttle real.

- Instalar `@nestjs/throttler` (compatível com Fastify ✓ — adaptador customizado em `apps/api/src/common/adapters/nutrigest-fastify.adapter.ts`).
- **`apps/api/src/../auth/throttler.config.ts`** com limites (rota pública → limite/min):
  - `login`: 30/min
  - `register`: 10/min
  - `refresh`: 30/min
  - `forgot-password`: 5/min
  - `reset-password`: 5/min
  - Fallback global: 100/min
- **`AppThrottlerGuard extends ThrottlerGuard`:** sobrescreve `canActivate` para retornar `true` sem aplicar throttle quando `process.env.NODE_ENV === 'test'` (suites existentes não quebram). Registrado como `APP_GUARD` no `AuthModule`.
- **429 testável:** `apps/api/test/throttle.e2e-spec.ts` com mini-módulo isolado: `ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 3 }] })` + controller dummy + `ThrottlerGuard` puro como `APP_GUARD` → a 4ª requisição responde **429**, independente de NODE_ENV.
- **Helmet:** usar `@fastify/helmet` (o pacote `helmet` é Express-only; o app é Fastify). Registrar no `main.ts`:
  ```ts
  app.register(await import('@fastify/helmet').then(m => m.default), { contentSecurityPolicy: false });
  ```
  (CSP desativado: API serve Swagger/JSON a outra origem — CSP não se aplica a respostas JSON.) E2e não passam por `main.ts`, então não são afetados.

### S6 — Silent refresh no interceptor do frontend

**`apps/web/src/lib/api.ts`** (interceptor de resposta):
- Em 401 (exceto reqs para `/auth/login` e `/auth/refresh`):
  1. **Single-flight:** flag `isRefreshing` + fila `pendingQueue` — requisições que chegam 401 durante um refresh em andamento aguardam a mesma chamada.
  2. Sucesso do `POST /auth/refresh` (com `refreshToken` do localStorage): grava novos `accessToken`/`refreshToken`, reexecuta cada requisição pendente com `Authorization` atualizado (guard `_retry` para não recursar).
  3. Falha: limpa tokens, rejeita fila, redireciona `/login` (comportamento atual mantido).
  4. Erros de rede (`!error.response`): rejeita com `getApiErrorMessage` (comportamento atual mantido — `apps/web/src/lib/api-error.ts`).
- **`apps/web/src/contexts/auth-context.tsx`:** **sem mudanças obrigatórias** — tokens vivem no localStorage e o `user` não muda no refresh. Mantém-se como está.

## Arquivos

**API**
- Modify: `apps/api/src/db/schema/refresh-tokens.ts` — `tokenDigest` + índice único
- Modify: `apps/api/src/db/schema/password-reset-tokens.ts` — `tokenDigest` + índice único
- Create: `apps/api/drizzle/` — migração gerada pelo drizzle-kit (drop tokenHash, add tokenDigest + índice, DELETE tokens existentes)
- Modify: `apps/api/src/auth/auth.service.ts` — refresh/reset/forgot O(1), reset com email
- Modify: `apps/api/src/auth/dto/reset-password.dto.ts` — add `email`
- Modify: `apps/api/src/auth/auth.controller.ts` — decorators `@Throttle` nas rotas públicas
- Create: `apps/api/src/auth/throttler.config.ts` — limites nomeados
- Create: `apps/api/src/auth/app-throttler.guard.ts` — guard (skip em test)
- Modify: `apps/api/src/auth/auth.module.ts` — `ThrottlerModule`, `APP_GUARD`
- Modify: `apps/api/src/main.ts` — `@fastify/helmet`
- Modify: `apps/api/package.json` — deps `@nestjs/throttler`, `@fastify/helmet`
- Modify: `apps/api/src/auth/auth.service.spec.ts` — testes O(1) + reset com email
- Modify: `apps/api/test/auth.e2e-spec.ts` — reset com email, forgot sem token em produção (NODE_ENV)
- Create: `apps/api/test/throttle.e2e-spec.ts` — 429

**Web**
- Modify: `apps/web/src/lib/api.ts` — silent refresh + fila
- Create/test: `apps/web/src/lib/api.test.ts` (Vitest, jsdom) — refresh único, fila concorrente, falha → logout
- Modify: `apps/web/package.json` — deps de teste necessárias já existem (vitest, jsdom, testing-library)

## Comportamento de erro / casos de borda

- **Refresh com token inexistente/vencido/reutilizado:** `UnauthorizedException('Invalid refresh token')` (mantido).
- **Reset com e-mail inválido:** 400 `BadRequestException('Invalid or expired reset token')` — mensagem genérica, não expõe se o e-mail existe.
- **Reset com token válido mas e-mail divergente:** mesmo 400 genérico.
- **`forgotPassword` em produção:** resposta neutra (sem `resetToken`); em dev/test retorna o token (permite e2e + teste manual).
- **401 durante refresh:** `_retry` evita loop infinito; falha do refresh = logout.
- **Erros de rede no web:** preserva `getApiErrorMessage` ("Servidor indisponível...").

## Testes / verificação

- `pnpm --filter @nutrigest/api test` — todos verdes (incl. auth.service.spec novos)
- `pnpm --filter @nutrigest/api test:e2e` — auth + throttler e2e
- `pnpm --filter @nutrigest/web test` — Vitest web (api.test.ts novo)
- `pnpm lint` (biome)
- `pnpm build:api` + `pnpm build:web`
- Teste manual (usuário): manter sessão aberta > 15min sem logout (silent refresh); rate limit visível após N tentativas de login falho.

## Fora de escopo / abertos

- Sem infra de e-mail neste projeto — decisão registrada: token retornado apenas em dev/test; fluxo de e-mail fica para infra futura.
- Job de limpeza de tokens expirados: **fora de escopo** (o refresh/reset já filtram por `expiresAt`; `forgotPassword` limpa os não-usurados do usuário ao solicitar novo).
- Rate limit por e-mail/IP-count (ex.: 3/hora por e-mail): o throttle é por IP (granularidade do ThrottlerGuard padrão). Aprovado pelo usuário como suficiente para o app de uso interno.
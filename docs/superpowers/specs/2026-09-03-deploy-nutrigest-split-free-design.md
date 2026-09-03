# Deploy Nutrigest — Split Grátis Sustentável (Vercel + Render + Neon) — Design

> **Contexto**: App Nutrigest (NestJS + Fastify + Drizzle + PG + React Vite) precisa de deploy grátis e consistente para portfólio de recrutadores. Restrições: 10 usuários max, sleep aceitável (60s cold start), upload desabilitado, $0/mês, domínio `nutritheone.com.br` no Registro.br. Conta existente só Vercel.

**Decisão arquitetural**: Split — `Vercel (frontend estático)` + `Render Free Web Service (API Docker)` + `Neon Free Postgres (serverless)`. Rejeita Railway Free ($1/mês crédito insuficiente) e Render Postgres Free (expira 30 dias, apaga dados) e Fly pago. Monólito descartado porque amarra frontend ao cold start da API e desperdiça CDN Vercel.

---

## 1. Objetivo e Escopo

Habilitar deploy produtivo que:
- Fique no ar indefinidamente sem expirar dados (Neon sem expiração vs Render 30 dias)
- Tenha frontend sempre instantâneo (Vercel CDN) mesmo com API dormindo
- Use Dockerfile existente com mudanças mínimas
- Domínio `nutritheone.com.br` no Registro.br apontando para ambos
- Sem volume persistido (upload desabilitado) — evita limite 0.5GB Free
- Sem commit de `.env`, só `.env.example`, variáveis injetadas em Vercel/Render

Fora de escopo: upload S3/R2, monitoramento, CI/CD além de Git auto-deploy, scaling, testes e2e contra prod.

---

## 2. Arquitetura

```
[Vercel]  https://nutritheone.com.br, https://www.nutritheone.com.br
          https://nutrigest.vercel.app (fallback)
          Build: pnpm --filter @nutrigest/web build → apps/web/dist
          Env: VITE_API_URL=https://api.nutritheone.com.br/api
                 │
                 │ HTTPS + CORS
                 ▼
[Render]  https://api.nutritheone.com.br (CNAME → nutrigest-api.onrender.com)
          https://nutrigest-api.onrender.com (fallback)
          Runtime: docker (Dockerfile), plan: free, sleep 15min
          PORT: 10000 (Render injeta), trustProxy:true
          HealthCheck: GET /api → 200 (Swagger) ou 404 JSON padronizado
          Env: DATABASE_URL (Neon), JWT_SECRET, CORS_ORIGIN, NODE_ENV=production
                 │
                 │ pg Pool ssl + idleTimeout 10s + allowExitOnIdle
                 ▼
[Neon]    ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
          Free: 3GB, scale-to-zero, 100h/mês, sem expiração
```

Fluxo local dev inalterado: `Vite proxy /api → localhost:3000`, `DATABASE_URL` localhost:5434.

---

## 3. Componentes e Contratos

### 3.1 Frontend (`apps/web`)
- Responsabilidade: SPA React, roteamento, queries, auth silent refresh
- Interface: `import.meta.env.VITE_API_URL` (string absoluta) ou fallback `/api` para dev
- Contrato atual: `axios baseURL '/api'` (relativo) — quebra em split, será `VITE_API_URL`
- Build: `tsc -b && vite build`, output `dist`, rewrite `/* → /index.html` via `vercel.json`

### 3.2 API (`apps/api`)
- Responsabilidade: NestJS modules, Drizzle, auth JWT, throttler, helmet
- Interface: `CORS_ORIGIN` como lista CSV (`a,b,c`) — parse e validação em `main.ts`
- DB: `DbService` com `pg.Pool` — precisa `ssl` em prod e `idleTimeoutMillis`+`allowExitOnIdle` para sleep Render
- Health: `GET /api` (Swagger) responde 200 sem auth — usado como healthcheck
- Entrypoint: migrar antes de subir (`drizzle-kit migrate`) + seed idempotente

### 3.3 Infra
- `render.yaml`: IaC para Render (dockerfilePath, healthCheckPath)
- `vercel.json`: rewrites SPA, buildCommand, outputDirectory
- `Dockerfile`: ajustes PORT dinâmico, healthcheck, entrypoint migrate
- `.env.example`: templates sem segredos

---

## 4. Fluxos

### 4.1 Deploy inicial
1. Criar projeto Neon → `DATABASE_URL`
2. Local: `DATABASE_URL=<neon> drizzle-kit migrate && pnpm seed` (valida conexão SSL)
3. Criar Render Web Service (Docker) → set envs → deploy → `https://xxx.onrender.com/api` ok
4. Criar Vercel project (Root `apps/web` ou monorepo) → env `VITE_API_URL` → deploy → login ok
5. Registro.br: adicionar `A @ → 76.76.21.21` + `CNAME www → cname.vercel-dns.com` + `CNAME api → xxx.onrender.com`, ativar HTTPS, atualizar envs para domínio final

### 4.2 Request recrutador
`www.nutritheone.com.br` (Vercel CDN, hit) → JS carrega → `fetch https://api.nutritheone.com.br/api/auth/login` → Render acorda se dormindo (60s) → Neon scale-to-zero acorda → JWT → queries.

### 4.3 Cold start
Render Free dorme 15min sem tráfego → próximo request 60s delay. Frontend continua instantâneo (cache Vercel). Neon escala a zero independentemente, mas acorda em <1s.

---

## 5. Erros e Edge Cases

- **CORS**: `CORS_ORIGIN` deve listar exatamente `https://nutritheone.com.br,https://www.nutritheone.com.br,https://*.vercel.app` — falta causa `blocked by CORS policy`. Solução: parse CSV e `origin: (origin, cb) => allowlist.includes(origin) ? cb(null,true) : cb(new Error('Not allowed by CORS'))` ou `origin: allowlist` com array.
- **Sleep**: recrutador vê 60s loading no primeiro acesso após inatividade — documentar no README/landing "primeiro carregamento pode levar 1min (servidor gratuito em repouso)"
- **Neon 100h**: improvável com 10 usuários e scale-to-zero (100h ≈ 4 dias contínuos). Se esgotar, branch default ainda conecta, só non-default pausa
- **Migrate falha**: entrypoint deve falhar deploy se `drizzle-kit migrate` falhar (não subir com schema desatualizado)
- **JWT_SECRET fraco**: `getJwtSecret()` já lança se <32 em prod — gerar com `openssl rand -base64 48`
- **Healthcheck falha**: usar `/api` que sempre 200 mesmo sem DB, não `/api/auth/me` que precisa DB
- **Env faltante**: `DATABASE_URL` ausente → `DbService` já lança erro claro

---

## 6. Alternativas consideradas

- **Railway Hobby $5/mês monólito**: sem sleep, com volume, Postgres plugin. Rejeitado por requisito $0, mas excelente upgrade futuro se precisar de UX instantânea em entrevistas
- **Render monólito + Neon**: mantém Dockerfile sem split, 1 URL. Rejeitado porque frontend sofre cold start desnecessário e perde Vercel
- **Fly.io**: rejeitado — sem free permanente
- **Supabase vs Neon**: Neon escolhido por 3GB vs 500MB Supabase e branching; ambos válidos, Neon ligeiramente melhor para Drizzle

---

## 7. Testes

- Unit: `getApiErrorMessage` e `api.ts` interceptor já cobertos — adicionar teste para `VITE_API_URL` fallback
- E2E local contra Neon staging (não prod): `DATABASE_URL=<neon-staging> pnpm test:e2e`
- Manual prod: `curl https://api.nutritheone.com.br/api` 200, login, CRUD stock, verificar `CORS` headers

---

## 8. Riscos e Mitigações

- Risco: Registro.br DNS demora 2-24h → mitigação: usar `vercel.app` e `onrender.com` como fallback enquanto propaga
- Risco: Vercel build falha por `pnpm` version → mitigação: `corepack enable` já no Dockerfile, Vercel usa Node 20+ pnpm 9
- Risco: Render free tem 750h/mês limite (suficiente, 1 serviço 24h = 720h) → ok para 1 serviço

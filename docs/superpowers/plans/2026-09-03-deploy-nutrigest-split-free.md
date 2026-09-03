# Deploy Nutrigest Split Grátis (Vercel + Render + Neon) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Nutrigest deployável em arquitetura split grátis permanente (frontend Vercel, API Docker Render Free com sleep, Postgres Neon) com domínio `nutritheone.com.br` no Registro.br, sem commit de `.env`, só `.env.example`, e com `VITE_API_URL` + `CORS_ORIGIN` + Pool SSL/idle.

**Architecture:** Vercel CDN serve `apps/web/dist` (Vite) com `VITE_API_URL` apontando para `https://api.nutritheone.com.br/api` (Render Web Service Docker Free, healthcheck `/api`, migrate no entrypoint, `trustProxy:true`). Render conecta em Neon `postgresql://...?sslmode=require` com Pool `ssl`+`idleTimeout 10s`+`allowExitOnIdle`. Registro.br faz `@/www → Vercel` e `api → Render`.

**Tech Stack:** Node 24, pnpm 9, NestJS 11 + Fastify 5, React 19 + Vite 8, Drizzle 0.43, pg 8, Neon serverless Postgres, Render Docker Free, Vercel Hobby, Registro.br DNS.

---

### Task 1: Frontend — suportar API absoluta via env

**Files:**
- Modify: `apps/web/src/lib/api.ts:8-10`
- Create: `apps/web/.env.example`
- Test: `apps/web/src/lib/api.test.ts` (opcional, se existir `api.test.ts`)

- [ ] **Step 1: Write failing check (manual)**

Crie `apps/web/.env.example` com `VITE_API_URL` e verifique que `api.ts` atual não lê env.

Run: `grep -n VITE_API_URL apps/web/src/lib/api.ts`
Expected: no output (fail — precisa suportar env)

- [ ] **Step 2: Implement `api.ts` com fallback**

```ts
// apps/web/src/lib/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})
// ... resto interceptors inalterado
```

Se `VITE_API_URL` não estiver setado (dev), cai em `/api` e usa proxy Vite (`vite.config.ts:17`). Em prod Vercel, injeta `https://api.nutritheone.com.br/api`.

- [ ] **Step 3: Verify**

Run: `grep -n VITE_API_URL apps/web/src/lib/api.ts`
Expected: shows `import.meta.env.VITE_API_URL`

Run: `pnpm --filter @nutrigest/web build` (dry)
Expected: PASS, `dist/index.html` gerado

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/.env.example
git commit -m "feat(web): support VITE_API_URL for split deploy (Vercel + Render)"
```

---

### Task 2: Frontend — `.env.example` correto

**Files:**
- Create: `apps/web/.env.example`
- Modify: `apps/web/.gitignore` (garantir `.env` ignorado, já está)

- [ ] **Step 1: Create file**

```env
# apps/web/.env.example — copie para .env e preencha para dev
# Para produção Vercel, configure VITE_API_URL nas Environment Variables do projeto (não commitar .env)
VITE_API_URL=http://localhost:3000/api
# Exemplo prod: VITE_API_URL=https://api.nutritheone.com.br/api
```

- [ ] **Step 2: Verify**

Run: `cat apps/web/.env.example`
Expected: shows VITE_API_URL

Run: `git check-ignore -v apps/web/.env` (se existir)
Expected: ignored

- [ ] **Step 3: Commit**

```bash
git add apps/web/.env.example
git commit -m "docs(web): add VITE_API_URL env example for split deploy"
```

---

### Task 3: API — CORS multi-origin + Pool SSL/idle

**Files:**
- Modify: `apps/api/src/main.ts:22-27`
- Modify: `apps/api/src/db/db.service.ts:27-29`
- Modify: `apps/api/.env.example:3`
- Test: `apps/api/src/db/db.service.spec.ts` (verificar Pool config)

- [ ] **Step 1: Fix CORS to support CSV list**

```ts
// apps/api/src/main.ts — replace enableCors block
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.enableCors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true,
})
```

Isso aceita `CORS_ORIGIN=https://nutritheone.com.br,https://www.nutritheone.com.br,https://nutrigest.vercel.app` (Render env) ou single dev.

- [ ] **Step 2: Fix Pool for Neon SSL + sleep**

```ts
// apps/api/src/db/db.service.ts:27
this.pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
})
```

`ssl` necessário para Neon `?sslmode=require`, `idleTimeout + allowExitOnIdle` permite Render dormir sem vazar conexões (docs Railway cut-idle-costs).

- [ ] **Step 3: Update .env.example**

```env
# apps/api/.env.example
DATABASE_URL=postgresql://nutrigest:nutrigest@localhost:5434/nutrigest
# Prod Neon example: DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
PORT=3000
CORS_ORIGIN=http://localhost:5173
# Prod example: CORS_ORIGIN=https://nutritheone.com.br,https://www.nutritheone.com.br,https://nutrigest.vercel.app
JWT_SECRET=change-me-to-32-chars-minimum-in-prod-xyz1234567890
JWT_REFRESH_SECRET=change-me-refresh-32-chars-too-xyz1234567890
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

- [ ] **Step 4: Verify lint & unit**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm --filter @nutrigest/api test -- db.service`
Expected: PASS (se existir teste)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/db/db.service.ts apps/api/.env.example
git commit -m "feat(api): CORS multi-origin + PG Pool SSL/idle for Neon/Render"
```

---

### Task 4: Dockerfile — PORT dinâmico + healthcheck + migrate entrypoint

**Files:**
- Modify: `Dockerfile:36-43`
- Create: `apps/api/docker-entrypoint.sh`
- Modify: `apps/api/package.json` (opcional start:prod script)

- [ ] **Step 1: Create entrypoint**

```sh
#!/bin/sh
set -e
echo "[entrypoint] Running drizzle migrations..."
npx drizzle-kit migrate || { echo "[entrypoint] migrate failed"; exit 1; }
echo "[entrypoint] Migrations ok. Starting API..."
exec node dist/src/main
```

Path: `apps/api/docker-entrypoint.sh`, `chmod +x`

- [ ] **Step 2: Update Dockerfile runner stage**

```dockerfile
FROM base AS runner
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /app/deploy ./
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
# Do not hardcode PORT — Render injects PORT=10000, local fallback 3000 in main.ts
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD curl -f http://localhost:${PORT:-3000}/api || exit 1

CMD ["sh", "./docker-entrypoint.sh"]
```

Notas:
- Antes: `ENV PORT=3000` hardcode + `curl /api-json` (falha com globalPrefix). Agora dinâmico + `/api` (Swagger 200)
- Se preferir sem shell script, use `CMD ["sh","-c","npx drizzle-kit migrate && node dist/src/main"]`
- Para split, remover `cp -r apps/web/dist /app/deploy/public` do stage build:28? Pode manter — se `public` existir mas não usado, não quebra; mas ideal remover para imagem menor. Deixar comentado: `# API split: web served via Vercel, public not needed`

- [ ] **Step 3: Verify docker build locally (dry)**

Run: `docker build -t nutrigest:split-test .`
Expected: PASS, image < 500MB

Run: `docker run --rm -e DATABASE_URL=postgresql://... -e JWT_SECRET=test123456789012345678901234567890 -p 3000:3000 nutrigest:split-test` (com Neon staging)
Expected: logs `Database connection established`, `migrate ok`, `Nest application successfully started`

- [ ] **Step 4: Commit**

```bash
git add Dockerfile apps/api/docker-entrypoint.sh
git commit -m "feat(docker): dynamic PORT, healthcheck /api, migrate entrypoint for Render+Neon"
```

---

### Task 5: Infra as Code — `render.yaml` + `vercel.json`

**Files:**
- Create: `render.yaml`
- Create: `vercel.json`
- Modify: `.gitignore` (garantir não ignora esses)

- [ ] **Step 1: render.yaml**

```yaml
services:
  - type: web
    name: nutrigest-api
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    plan: free
    healthCheckPath: /api
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false # set manually in Render dashboard (Neon URL)
      - key: JWT_SECRET
        sync: false
      - key: CORS_ORIGIN
        value: https://nutritheone.com.br,https://www.nutritheone.com.br
      - key: UPLOAD_DIR
        value: uploads
```

- [ ] **Step 2: vercel.json (raiz)**

```json
{
  "buildCommand": "pnpm --filter @nutrigest/web build",
  "outputDirectory": "apps/web/dist",
  "framework": "vite",
  "installCommand": "pnpm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Alternativa: se Vercel Root Directory = `apps/web`, então `vercel.json` dentro de `apps/web` com `outputDirectory: dist`.

- [ ] **Step 3: Verify**

Run: `cat render.yaml && cat vercel.json`
Expected: valid YAML/JSON

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add render.yaml vercel.json
git commit -m "chore(infra): add render.yaml + vercel.json for split deploy"
```

---

### Task 6: Docs — README deploy section + env checklist

**Files:**
- Modify: `README.md` (add Deploy section)
- Create: `docs/DEPLOY.md` (passo a passo recrutador)

- [ ] **Step 1: Add README Deploy**

```md
## Deploy (Split Grátis)

- Web: Vercel (Hobby) → https://nutritheone.com.br
- API: Render Free Docker → https://api.nutritheone.com.br
- DB: Neon Free → us-east-1
Primeiro acesso após 15min pode levar 60s (cold start Render Free).

Ver `docs/DEPLOY.md` para passo a passo.
```

- [ ] **Step 2: Commit**

```bash
git add README.md docs/DEPLOY.md
git commit -m "docs: add split deploy guide (Vercel+Render+Neon)"
```

---

### Verificação Final (antes de entregar)

Run: `pnpm lint && pnpm --filter @nutrigest/web build && pnpm --filter @nutrigest/api build`
Expected: PASS

Run: `docker build -t nutrigest:test . && echo "docker ok"`
Expected: PASS

Check: `git status` shows no `.env` staged, only `.env.example`
Check: `curl https://api.nutritheone.com.br/api` 200 after Render deploy
Check: Vercel env `VITE_API_URL` set, login works

---

### Execução handoff

Plan salvo. Opções:
1. **Subagent-Driven (recomendado)** — dispatch fresh subagent per task, review entre tasks
2. **Inline** — executar tasks nesta sessão via executing-plans

Qual abordagem? (Para este projeto, inline é suficiente — 6 tasks pequenas)

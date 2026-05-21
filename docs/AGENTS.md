# Nutrigest — Regras de Desenvolvimento

## Stack

- **Backend:** NestJS + Fastify + Drizzle ORM + PostgreSQL
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + React Query + React Hook Form + Zod
- **Linter/Formatter:** Biome (v2)
- **Monorepo:** pnpm workspaces
- **Banco:** PostgreSQL (porta 5434)

## Estrutura

```
nutrigest/
├── apps/
│   ├── api/          # NestJS + Fastify + Drizzle
│   └── web/          # React + Vite
├── packages/
│   └── shared/       # Tipos/enums compartilhados
├── docs/
│   └── superpowers/specs/  # Especificações
├── biome.json
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Comandos

```bash
# Desenvolvimento
pnpm dev:api      # Inicia API em http://localhost:3000
pnpm dev:web      # Inicia Web em http://localhost:5173

# Build
pnpm build:api
pnpm build:web

# Lint / Format (Biome)
pnpm lint         # biome check (read-only)
pnpm format       # biome check --write (aplica correções)
pnpm lint:ci      # biome ci (modo estrito para CI)

# Banco (Drizzle)
pnpm --filter @nutrigest/api exec drizzle-kit generate
pnpm --filter @nutrigest/api exec drizzle-kit migrate
pnpm --filter @nutrigest/api exec drizzle-kit studio

# Docker
docker compose up -d        # Sobe PostgreSQL
docker compose down         # Para serviços
```

## Convenções

- Commits em português (ou inglês, mantendo consistência)
- Seguir spec-driven development: documentar antes de implementar
- Testes com Jest (API) e Vitest (Web)
- Validação com Zod no backend e frontend

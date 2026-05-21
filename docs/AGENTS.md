# Nutrigest — Regras de Desenvolvimento

## Stack

- **Backend:** NestJS + Fastify + Drizzle ORM + PostgreSQL
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + React Query + React Hook Form + Zod
- **Linter/Formatter:** Biome (v2)
- **Monorepo:** pnpm workspaces
- **Banco:** PostgreSQL (porta 5434)
- **Auth:** JWT + Refresh Token + bcrypt

## Estrutura

```
nutrigest/
├── apps/
│   ├── api/          # NestJS + Fastify + Drizzle
│   └── web/          # React + Vite
├── packages/
│   └── shared/       # Tipos/enums compartilhados
├── docs/
│   ├── AGENTS.md
│   ├── TODO.md
│   └── superpowers/
│       ├── specs/    # Especificações
│       └── plans/    # Planos de implementação
├── biome.json
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Comandos

```bash
# Desenvolvimento
pnpm dev:api                 # Inicia API em http://localhost:3000
pnpm dev:web                 # Inicia Web em http://localhost:5173

# Build
pnpm build:api
pnpm build:web

# Lint / Format (Biome)
pnpm lint                    # biome check (read-only)
pnpm format                  # biome check --write (aplica correções)
pnpm lint:ci                 # biome ci (modo estrito para CI)

# Testes (Jest)
pnpm --filter @nutrigest/api test          # Todos os testes
pnpm --filter @nutrigest/api test:e2e      # Testes e2e
pnpm --filter @nutrigest/api test:watch    # Watch mode

# Banco (Drizzle)
pnpm --filter @nutrigest/api exec drizzle-kit generate   # Gera migração
pnpm --filter @nutrigest/api exec drizzle-kit migrate    # Aplica migração
pnpm --filter @nutrigest/api exec drizzle-kit studio     # Drizzle Studio
pnpm --filter @nutrigest/api seed                        # Popula admin: admin@nutrigest.com / Admin@123

# Docker
docker compose up -d         # Sobe PostgreSQL
docker compose down          # Para serviços
```

## Convenções

### Desenvolvimento

- **Feature-first:** Cada feature implementada, testada e aprovada antes de passar para a próxima
- **Backend-first:** API completa antes de qualquer frontend
- **TDD:** Testes primeiro, implementação depois
- **Commits convencionais:** `feat:`, `test:`, `docs:`, `refactor:`, `fix:`
- **Branch:** Desenvolvimento na `dev`, merges para `main` após aprovação
- **Spec-driven:** Toda feature documentada em `docs/superpowers/`
- **Swagger:** Toda rota documentada com decorators OpenAPI

### Padrão de cada feature

1. Schema Drizzle + migração
2. DTOs com validação Zod
3. Service com lógica de negócio
4. Controller com Swagger decorators
5. Testes unitários (Jest)
6. Testes e2e (supertest + Fastify)
7. Seed data se aplicável
8. Lint + Build + Testes passando
9. Commit e aprovação

### Stack de validação

- DTO validation: `nestjs-zod` (Zod integrado ao NestJS)
- Senhas: bcrypt com salt rounds = 10
- JWT: `@nestjs/jwt` + `passport-jwt` com strategy
- Refresh token: armazenado em banco com hash, rotação a cada uso

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

## Git Workflow

### Branches
- `main` — Produção. Apenas merges vindos de `dev` após aprovação completa.
- `dev` — Integração. Feature branches são mergeados aqui via PR.
- `feat/<nome>` — Desenvolvimento ativo. Criado a partir de `dev`.

### Fluxo
1. Criar feature branch: `git checkout -b feat/<nome> dev`
2. Desenvolver (vários commits)
3. Abrir PR no GitHub: `feat/<nome>` → `dev`
4. **Aguardar aprovação manual** — não mergear automaticamente
5. Após merge em `dev` pelo usuário, continuar próximo desenvolvimento
6. `dev` → `main` apenas quando a fase estiver completa e testada

### Commits
- Usar commits convencionais: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`
- Um commit por sub-feature (ex: `feat: add user registration with auth module`)
- Commits atômicos: cada commit representa uma unidade lógica completa

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

# Testes (Jest) — usam banco nutrigest_test (isolado)
pnpm --filter @nutrigest/api test          # Todos os testes
pnpm --filter @nutrigest/api test:e2e      # Testes e2e
pnpm --filter @nutrigest/api test:watch    # Watch mode
pnpm --filter @nutrigest/api db:test:setup # Cria + migra nutrigest_test (1 vez)

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
- **Branch:** Feature branch → PR → `dev` (merge manual) → `main` (futuro)
- **Spec-driven:** Toda feature documentada em `docs/superpowers/`
- **Swagger:** Toda rota documentada com decorators OpenAPI

### Frontend (Web)

- **Mobile-first:** Todo layout deve ser responsivo e priorizar telas pequenas (celulares/tablets). O app será usado primariamente em dispositivos móveis.
- **Testes:** Vitest + Testing Library para testes unitários de componentes e páginas. Testes de API cobertos pelo backend (Jest).
- **Componentes:** Primitivos próprios (shadcn/ui style) com Tailwind. Sem bibliotecas de UI prontas.
- **Gráficos:** SVG puro (BarChart customizado). Sem recharts ou chart.js.

## Endpoints Atuais

### Auth (`/auth`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/register` | — | Registrar novo usuário |
| POST | `/auth/login` | — | Login (retorna accessToken + refreshToken + user) |
| POST | `/auth/refresh` | — | Refresh token (rotação + reuse detection) |
| GET | `/auth/me` | JWT Bearer | Obter perfil do usuário logado |
| PATCH | `/auth/me` | JWT Bearer | Atualizar nome/email/senha do perfil |
| POST | `/auth/logout` | JWT Bearer | Logout (revoga todos os refresh tokens do user) |
| POST | `/auth/forgot-password` | — | Solicitar token de reset de senha |
| POST | `/auth/reset-password` | — | Resetar senha com token |

### Central Stock (`/central-stock`)

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| GET | `/central-stock` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar estoque (com dados do produto) |
| GET | `/central-stock/:productId` | JWT | ADMIN, TECHNICIAN, OPERATOR | Buscar estoque por ID do produto |
| PATCH | `/central-stock/:productId` | JWT | ADMIN, TECHNICIAN | Ajustar quantidade (valor absoluto) |

### Minibar Standard (`/minibar-standard`)

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| GET | `/minibar-standard/rooms` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar quartos disponíveis (101-110) |
| GET | `/minibar-standard/:room` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar padrão do quarto |
| POST | `/minibar-standard/:room` | JWT | ADMIN, TECHNICIAN | Adicionar/substituir item (upsert) |
| PATCH | `/minibar-standard/:room/:productId` | JWT | ADMIN, TECHNICIAN | Atualizar quantidade padrão |
| DELETE | `/minibar-standard/:room/:productId` | JWT | ADMIN, TECHNICIAN | Remover item (204) |

### Stock Movements (`/stock-movements`)

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| GET | `/stock-movements` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar movimentações (filtros: type, room, data, paginação) |
| POST | `/stock-movements/in` | JWT | ADMIN, TECHNICIAN | Registrar entrada de mercadorias (batch) |
| POST | `/stock-movements/replenish/:room` | JWT | ADMIN, TECHNICIAN, OPERATOR | Reposição de frigobar |
| POST | `/stock-movements/meal-out` | JWT | ADMIN, TECHNICIAN, OPERATOR | Retirada de marmita |

### Products (`/products`)

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/products` | JWT | ADMIN, TECHNICIAN, OPERATOR | Listar todos |
| GET | `/products/:id` | JWT | ADMIN, TECHNICIAN, OPERATOR | Buscar por ID |
| POST | `/products` | JWT | ADMIN, TECHNICIAN | Criar |
| PATCH | `/products/:id` | JWT | ADMIN, TECHNICIAN | Atualizar |
| DELETE | `/products/:id` | JWT | ADMIN | Remover |
| POST | `/products/:id/image` | JWT | ADMIN, TECHNICIAN | Upload/substituir imagem |
| DELETE | `/products/:id/image` | JWT | ADMIN, TECHNICIAN | Remover imagem |

### Users (`/users`) — admin only

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/users` | JWT + ADMIN | Listar todos os usuários |
| GET | `/users/:id` | JWT + ADMIN | Buscar usuário por ID |
| POST | `/users` | JWT + ADMIN | Criar novo usuário |
| PATCH | `/users/:id` | JWT + ADMIN | Atualizar usuário |
| DELETE | `/users/:id` | JWT + ADMIN | Deletar usuário |

### RBAC

- **Roles:** `ADMIN`, `TECHNICIAN`, `OPERATOR`
- `@Roles('ADMIN')` — decorator para restringir endpoints por role
- `RolesGuard` + `JwtAuthGuard` — aplicados globalmente ou por controller
- Apenas `ADMIN` tem acesso aos endpoints `/users/*`

### Segurança

- **Sessão única:** Ao fazer login, todos os refresh tokens antigos do usuário são deletados
- **Logout:** Revoga todos os refresh tokens do usuário (uso em dispositivo compartilhado)
- **Access token:** JWT com expiração de 15min (stateless)
- **Refresh token:** Opaque random hex, bcrypt hash no banco, expira em 7 dias

### Padrão de cada feature

1. Schema Drizzle + migração
2. DTOs com validação Zod
3. Service com lógica de negócio
4. Controller com Swagger decorators
5. Testes unitários (Jest) — timeout 30s (bcrypt)
6. Testes e2e — timeout 30s (bcrypt)
7. Seed data se aplicável
8. Lint + Build + Testes passando
9. Commit e abertura de PR

### Stack de validação

- DTO validation: `nestjs-zod` (Zod integrado ao NestJS)
- Senhas: bcrypt com salt rounds = 10
- JWT: `@nestjs/jwt` + `passport-jwt` com strategy
- Refresh token: armazenado em banco com bcrypt hash, rotação a cada uso

# Nutrigest

> **Sistema de Controle de Estoque Nutricional** — Gerencie frigobares, marmitas e movimentações de estoque com rastreabilidade completa.

## Problema

A nutricionista controla o estoque de bebidas (frigobares dos leitos 101–110) e marmitas usando papel. As copeiras anotam traços para cada retirada de marmita, sem rastreabilidade. A reposição dos frigobares é registrada de forma precária. Não há visibilidade em tempo real do saldo de marmitas para planejar pedidos ao fornecedor. O processo é vulnerável a erros e não atende auditoria.

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Runtime** | Node.js |
| **Backend** | NestJS + Fastify + Drizzle ORM |
| **Banco** | PostgreSQL 16 |
| **Validação** | Zod + nestjs-zod |
| **Auth** | JWT (access 15min) + Refresh Token (7 dias, bcrypt + rotação) |
| **Upload** | @fastify/multipart |
| **Documentação** | Swagger (OpenAPI) |
| **Frontend** | React + Vite + TypeScript + Tailwind CSS v4 (em breve) |
| **Linter/Formatter** | Biome v2 |
| **Monorepo** | pnpm workspaces |
| **Infra** | Docker Compose |

## Arquitetura

```mermaid
flowchart LR
    Client[React App<br/>em breve] --> API[NestJS + Fastify<br/>:3000]
    API --> DB[(PostgreSQL<br/>:5434)]
    API --> Storage[Uploads<br/>local]
    API --> Swagger[Swagger UI<br/>/api]

    subgraph API [Backend]
        Auth[Auth Module]
        Users[Users Module]
        Products[Products Module]
        CentralStock[CentralStock Module]
        Minibar[MinibarStandard Module]
        StockMov[StockMovements Module]
        Dashboard[Dashboard Module]

        Auth --> Users
        StockMov --> CentralStock
        Dashboard --> Products
        Dashboard --> CentralStock
        Dashboard --> StockMov
    end
```

## Modelo de Dados

```mermaid
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar passwordHash
        enum role "ADMIN | TECHNICIAN | OPERATOR"
        timestamp createdAt
        timestamp updatedAt
    }

    products {
        uuid id PK
        varchar name
        enum category "BEVERAGE | MEAL"
        varchar unit "default 'un'"
        varchar imageUrl
        timestamp createdAt
        timestamp updatedAt
    }

    central_stock {
        uuid productId PK,FK
        int quantity "default 0"
        timestamp updatedAt
    }

    minibar_standard {
        int room "101-110"
        uuid productId FK
        int standardQuantity
        timestamp createdAt
        UK room + productId
    }

    stock_movements {
        uuid id PK
        enum type "IN | REPLENISH | MEAL_OUT"
        uuid productId FK
        int quantity
        int room "nullable, only REPLENISH"
        uuid userId FK
        varchar description "nullable"
        timestamp createdAt
    }

    refresh_tokens {
        id PK
        uuid userId FK
        varchar tokenHash
        timestamp expiresAt
        timestamp createdAt
    }

    password_reset_tokens {
        id PK
        uuid userId FK
        varchar tokenHash
        timestamp expiresAt
        timestamp usedAt "nullable"
        timestamp createdAt
    }

    products ||--o{ central_stock : "1..1"
    products ||--o{ minibar_standard : "1..*"
    products ||--o{ stock_movements : "1..*"
    users ||--o{ stock_movements : "1..*"
    users ||--o{ refresh_tokens : "1..*"
    users ||--o{ password_reset_tokens : "1..*"
```

## Pré-requisitos

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** + **Docker Compose** (para PostgreSQL)

## Setup rápido

```bash
# 1. Clone e instale dependências
git clone <repo>
cd nutrigest
pnpm install

# 2. Sobe PostgreSQL
docker compose up -d

# 3. Configure variáveis de ambiente
cp apps/api/.env.example apps/api/.env

# 4. Gere e aplique migrações
pnpm --filter @nutrigest/api exec drizzle-kit generate
pnpm --filter @nutrigest/api exec drizzle-kit migrate

# 5. Popule dados iniciais (cria admin)
pnpm --filter @nutrigest/api seed

# 6. Inicie a API
pnpm dev:api
```

A API estará em **http://localhost:3000** e o Swagger em **http://localhost:3000/api**.

Usuário admin padrão: `admin@nutrigest.com` / `Admin@123`

## Comandos

```bash
pnpm dev:api            # Inicia API em http://localhost:3000
pnpm dev:web            # Inicia Web em http://localhost:5173
pnpm build:api          # Build da API
pnpm build:web          # Build do frontend
pnpm lint               # Biome check (read-only)
pnpm format             # Biome check --write

# Testes
pnpm --filter @nutrigest/api test          # Unitários
pnpm --filter @nutrigest/api test:e2e      # E2E
pnpm --filter @nutrigest/api test:watch    # Watch mode

# Banco de dados
pnpm --filter @nutrigest/api exec drizzle-kit generate   # Gera migração
pnpm --filter @nutrigest/api exec drizzle-kit migrate    # Aplica migração
pnpm --filter @nutrigest/api exec drizzle-kit studio     # Drizzle Studio
pnpm --filter @nutrigest/api seed                        # Popula admin

# Docker
docker compose up -d    # Sobe PostgreSQL
docker compose down     # Para serviços
```

## API

### Autenticação

Todas as rotas (exceto `register`, `login`, `refresh`, `forgot-password`, `reset-password`) exigem **JWT Bearer Token** no header `Authorization`.

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | `/auth/register` | — | Registrar novo usuário |
| POST | `/auth/login` | — | Login (retorna `accessToken` + `refreshToken` + `user`) |
| POST | `/auth/refresh` | — | Refresh token com rotação + reuse detection |
| POST | `/auth/forgot-password` | — | Solicita token de reset por email |
| POST | `/auth/reset-password` | — | Redefine senha com token |
| GET | `/auth/me` | * | Perfil do usuário logado |
| PATCH | `/auth/me` | * | Atualizar nome, email ou senha |
| POST | `/auth/logout` | * | Revoga todos os refresh tokens |

### Users (admin)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/users` | ADMIN | Listar todos os usuários |
| GET | `/users/:id` | ADMIN | Buscar usuário por ID |
| POST | `/users` | ADMIN | Criar novo usuário |
| PATCH | `/users/:id` | ADMIN | Atualizar dados de um usuário |
| DELETE | `/users/:id` | ADMIN | Remover usuário |

### Products

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/products` | * | Listar todos os produtos |
| GET | `/products/:id` | * | Buscar produto por ID |
| POST | `/products` | ADMIN, TECHNICIAN | Criar produto |
| PATCH | `/products/:id` | ADMIN, TECHNICIAN | Atualizar produto |
| DELETE | `/products/:id` | ADMIN | Remover produto |
| POST | `/products/:id/image` | ADMIN, TECHNICIAN | Upload/substituir imagem (max 5 MB) |
| DELETE | `/products/:id/image` | ADMIN, TECHNICIAN | Remover imagem |

### Central Stock

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/central-stock` | * | Listar estoque com dados do produto |
| GET | `/central-stock/:productId` | * | Buscar saldo de um produto |
| PATCH | `/central-stock/:productId` | ADMIN, TECHNICIAN | Ajustar quantidade (valor absoluto) |

### Minibar Standard

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/minibar-standard/rooms` | * | Listar quartos disponíveis (101–110) |
| GET | `/minibar-standard/:room` | * | Listar padrão do quarto |
| POST | `/minibar-standard/:room` | ADMIN, TECHNICIAN | Adicionar/substituir item (upsert) |
| PATCH | `/minibar-standard/:room/:productId` | ADMIN, TECHNICIAN | Atualizar quantidade padrão |
| DELETE | `/minibar-standard/:room/:productId` | ADMIN, TECHNICIAN | Remover item do padrão |

### Stock Movements

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/stock-movements` | * | Listar movimentações (filtros: `type`, `room`, `from`, `to`, `page`, `limit`) |
| POST | `/stock-movements/in` | ADMIN, TECHNICIAN | Registrar entrada de mercadorias (batch) |
| POST | `/stock-movements/replenish/:room` | * | Reposição de frigobar (deduz do estoque) |
| POST | `/stock-movements/meal-out` | * | Retirada de marmita (deduz do estoque) |

### Dashboard

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/dashboard/summary` | ADMIN, TECHNICIAN | Totais, alertas de estoque baixo, movimentações do dia |
| GET | `/dashboard/consumption-by-room` | ADMIN, TECHNICIAN | Consumo agrupado por quarto (filtros: `from`, `to`) |
| GET | `/dashboard/consumption-by-room/csv` | ADMIN, TECHNICIAN | Exportar CSV do consumo por quarto |
| GET | `/dashboard/meal-ranking` | ADMIN, TECHNICIAN | Ranking de marmitas mais consumidas (filtros: `from`, `to`, `limit`) |
| GET | `/dashboard/meal-ranking/csv` | ADMIN, TECHNICIAN | Exportar CSV do ranking de marmitas |
| GET | `/dashboard/stock-history/:productId` | ADMIN, TECHNICIAN | Histórico de movimentações com saldo acumulado |
| GET | `/dashboard/stock-history/:productId/csv` | ADMIN, TECHNICIAN | Exportar CSV do histórico do produto |
| GET | `/dashboard/charts/monthly-consumption` | ADMIN, TECHNICIAN | Consumo mensal (REPLENISH vs MEAL_OUT) para gráfico de linha |
| GET | `/dashboard/charts/room-comparison` | ADMIN, TECHNICIAN | Comparativo de consumo por quarto para gráfico de barras |
| GET | `/dashboard/charts/category-distribution` | ADMIN, TECHNICIAN | Distribuição do estoque por categoria (BEVERAGE vs MEAL) para gráfico de pizza |
| GET | `/dashboard/charts/stock-evolution/:productId` | ADMIN, TECHNICIAN | Evolução do saldo ao longo do tempo para gráfico de linha |

> `*` = ADMIN, TECHNICIAN, OPERATOR

## RBAC

| Role | Acesso |
|------|--------|
| **ADMIN** | Tudo — CRUD de usuários, produtos, estoque, dashboard |
| **TECHNICIAN** | Tudo exceto gerenciamento de usuários e exclusão de produtos |
| **OPERATOR** | Operações do dia a dia: registrar consumo, repor frigobar, retirar marmita. **Sem acesso ao Dashboard.** |

## Segurança

- **Sessão única:** Ao fazer login, todos os refresh tokens anteriores do usuário são revogados
- **Logout:** Revoga todos os refresh tokens — seguro para dispositivos compartilhados
- **Access token:** JWT stateless, expira em 15 minutos
- **Refresh token:** Opaque random hex, armazenado com bcrypt hash, expira em 7 dias com rotação
- **Senhas:** bcrypt com salt rounds = 10
- **Validação:** Zod schemas em todas as entradas, pipe global `ZodValidationPipe`
- **Upload:** Limite de 5 MB por arquivo

## Estrutura do Projeto

```
nutrigest/
├── apps/
│   ├── api/                     # NestJS + Fastify
│   │   ├── src/
│   │   │   ├── auth/            # Autenticação (JWT, refresh, password reset)
│   │   │   ├── users/           # CRUD de usuários (admin)
│   │   │   ├── products/        # CRUD de produtos + imagens
│   │   │   ├── central-stock/   # Estoque central
│   │   │   ├── minibar-standard/# Padrão de frigobar por quarto
│   │   │   ├── stock-movements/ # Movimentações (IN, REPLENISH, MEAL_OUT)
│   │   │   ├── dashboard/       # Dashboard, relatórios, charts, CSV export
│   │   │   ├── db/              # Conexão Drizzle + schemas + migrations
│   │   │   ├── storage/         # Abstração de armazenamento (local)
│   │   │   └── common/          # Decorators, guards, filters
│   │   ├── test/                # Testes e2e
│   │   └── drizzle/             # Migrations geradas
│   └── web/                     # React + Vite (em breve)
├── packages/
│   └── shared/                  # Tipos/enums compartilhados
├── docs/
│   ├── AGENTS.md                # Regras de desenvolvimento
│   ├── TODO.md                  # Roadmap
│   └── superpowers/
│       ├── specs/               # Especificações técnicas
│       └── plans/               # Planos de implementação
├── docker-compose.yml
├── biome.json
└── pnpm-workspace.yaml
```

## Desenvolvimento

### Workflow

1. Crie uma branch: `git checkout -b feat/nome-da-feature dev`
2. Desenvolva seguindo TDD (testes → implementação)
3. Commit por sub-feature (`feat:`, `test:`, `fix:`)
4. Abra PR no GitHub: `feat/nome-da-feature` → `dev`
5. Após aprovação manual, faça merge em `dev`

### Ambiente de teste

Banco isolado `nutrigest_test` na porta 5434:

```bash
pnpm --filter @nutrigest/api db:test:setup    # Criar banco + migrar (1x)
pnpm --filter @nutrigest/api test             # Rodar testes
pnpm --filter @nutrigest/api test:e2e         # Rodar e2e
```

### Variáveis de ambiente

```env
# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5434/database
PORT=3000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=<seu-secret>
JWT_REFRESH_SECRET=<seu-refresh-secret>
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

## Licença

UNLICENSED — Projeto privado.

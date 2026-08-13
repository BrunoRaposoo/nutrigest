# Nutrigest

> **Sistema de Controle de Estoque Nutricional** — Gerencie frigobares, marmitas e movimentações de estoque com rastreabilidade completa. Backend em NestJS + Fastify, frontend em React + Vite + Tailwind CSS v4.

## Problema

A nutricionista controla o estoque de bebidas (frigobares dos leitos 101–110) e marmitas usando papel. As copeiras anotam traços para cada retirada de marmita, sem rastreabilidade. A reposição dos frigobares é registrada de forma precária. Não há visibilidade em tempo real do saldo de marmitas para planejar pedidos ao fornecedor. O processo é vulnerável a erros e não atende auditoria.

## Status do Projeto

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 1 — Backend (API)** | ✅ Completo | Auth, CRUDs, estoque, movimentações, dashboard, relatórios, charts, CSV/PDF export |
| **Fase 2 — Frontend (Web)** | ✅ Completo | React + Vite + TypeScript, 7 páginas, design system, tema dark/light |
| **Fase 3 — Correções de qualidade** | ✅ Completo | Segurança (register, JWT, rate limit, helmet), integridade de estoque (operações atômicas), tratamento de erros no frontend, silent refresh, índices, CSV sanitização |

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Runtime** | Node.js ≥ 20 |
| **Backend** | NestJS 11 + Fastify (adaptador customizado `NutrigestFastifyAdapter`) + Drizzle ORM |
| **Banco** | PostgreSQL 16 (via Docker Compose, porta `5434`) |
| **Validação** | Zod + `nestjs-zod` (ZodValidationPipe global) |
| **Auth** | JWT (access token 15min) + Refresh Token (opaque random hex 48 bytes, digest sha256 no banco, 7 dias, rotação + reuse detection) |
| **Rate limit** | `@nestjs/throttler` nos endpoints públicos de auth |
| **Headers de segurança** | `@fastify/helmet` (CSP desativado) |
| **Upload** | `@fastify/multipart` (max 5 MB) |
| **Documentação API** | Swagger (OpenAPI) via `@nestjs/swagger` |
| **Relatórios** | PDF via `pdfkit` + CSV nativo (com proteção contra formula injection) |
| **Compartilhado** | `@nutrigest/shared` (constantes `VALID_ROOMS`, `LOW_STOCK_THRESHOLD`, enums) |
| **Frontend** | React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 |
| **State/Fetch** | `@tanstack/react-query` + `axios` (interceptor com silent refresh) |
| **Formulários** | `react-hook-form` + `@hookform/resolvers` + Zod |
| **Roteamento** | `react-router-dom` v7 |
| **Animações** | `framer-motion` |
| **Ícones** | `lucide-react` |
| **Gráficos** | SVG puro (BarChart customizado) |
| **Linter/Formatter** | Biome v2 |
| **Monorepo** | pnpm workspaces |
| **Infra** | Docker Compose (PostgreSQL 16 Alpine) |

## Arquitetura

```mermaid
flowchart LR
    Browser[React App<br/>:5173] --> ViteProxy[Vite Proxy<br/>/api e /uploads -> :3000]
    ViteProxy --> API[NestJS + Fastify<br/>:3000]
    API --> DB[(PostgreSQL<br/>:5434)]
    API --> Storage[Uploads<br/>local]
    API --> Swagger[Swagger UI<br/>/api]

    subgraph API [Backend - NestJS Modules]
        Auth[Auth Module<br/>+ Throttler + Helmet]
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

### Estratégia de Conexão

A API aplica o **prefixo global `/api`** (`app.setGlobalPrefix('api')`), então todos os endpoints são servidos em `http://localhost:3000/api/*`. O frontend usa `baseURL: '/api'`.

O Vite dev server faz proxy de `/api` e `/uploads` para `http://localhost:3000` (mantendo o prefixo `/api`), eliminando a necessidade de configurar CORS durante o desenvolvimento. Em produção, a API serve o build estático do frontend (`public/`) com fallback SPA para `index.html`.

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
        text imageUrl
        timestamp createdAt
        timestamp updatedAt
    }

    central_stock {
        uuid productId PK,FK "onDelete cascade"
        int quantity "default 0, CHECK >= 0"
        timestamp updatedAt
    }

    minibar_standard {
        int room "101-110"
        uuid productId FK "onDelete cascade"
        int standardQuantity "default 1"
        timestamp createdAt
        UK room + productId
    }

    stock_movements {
        uuid id PK
        enum type "IN | CONSUMPTION | REPLENISH | MEAL_OUT"
        uuid productId FK
        int quantity
        int room "nullable, only REPLENISH"
        uuid userId FK
        text description "nullable"
        timestamp createdAt
    }

    refresh_tokens {
        uuid id PK
        uuid userId FK "onDelete cascade"
        varchar tokenDigest "sha256 hex, UK"
        timestamp expiresAt
        timestamp createdAt
    }

    password_reset_tokens {
        uuid id PK
        uuid userId FK "onDelete cascade"
        varchar tokenDigest "sha256 hex, UK"
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

Índices adicionados por migração para performance: `stock_movements` (`type`, `productId`, `userId`, `createdAt`), `refresh_tokens.userId` e `password_reset_tokens.userId`. O estoque central possui `CHECK (quantity >= 0)` como rede de segurança contra saldo negativo.

### Tipos de Movimentação

| Tipo | Descrição | Impacto no Estoque |
|------|-----------|-------------------|
| `IN` | Entrada de mercadorias (compra) | Aumenta |
| `CONSUMPTION` | Consumo do frigobar (automático na reposição) | Diminui |
| `REPLENISH` | Reposição do frigobar (automático) | Sem impacto (sai do central) |
| `MEAL_OUT` | Retirada de marmita | Diminui |

O fluxo de **reposição de frigobar** cria dois registros: um `CONSUMPTION` (deduz do estoque o que foi consumido) e um `REPLENISH` (registra o que foi reposto no quarto), ambos transacionalmente. Todas as operações de estoque usam **incrementos/decrementos atômicos** no banco (`sql` + condição `WHERE quantity >= amount`), eliminando perda de atualização e oversell sob concorrência.

## RBAC (Role-Based Access Control)

| Role | Acesso |
|------|--------|
| **ADMIN** | Acesso total — CRUD de usuários, produtos, estoque, dashboard, relatórios |
| **TECHNICIAN** | Tudo exceto gerenciamento de usuários (`/users/*`) e exclusão de produtos |
| **OPERATOR** | Operações do dia a dia: listar produtos/estoque, registrar consumo, repor frigobar, retirar marmita. **Sem acesso ao Dashboard ou relatórios.** |

Implementado via `@Roles()` decorator + `RolesGuard` + `JwtAuthGuard` do Passport.

> **Segurança no registro:** `POST /auth/register` é público e **não aceita `role`** — todo usuário criado por este endpoint é `OPERATOR`. Contas com outras roles são criadas exclusivamente via `/users` (ADMIN only).

## API — Endpoints

> Base URL: `http://localhost:3000/api` (Swagger UI: `http://localhost:3000/api`)
>
> Rotas protegidas exigem header: `Authorization: Bearer <accessToken>`
>
> Endpoints públicos de auth possuem **rate limit por IP** (ver `@Throttle` em cada rota).

### Autenticação (`/auth`)

| Método | Rota | Auth | Rate limit | Descrição |
|--------|------|------|-----------|-----------|
| POST | `/auth/register` | — | 10/min | Registrar novo usuário (sempre `role: OPERATOR`) |
| POST | `/auth/login` | — | 30/min | Login (retorna `accessToken` + `refreshToken` + `user`) |
| POST | `/auth/refresh` | — | 30/min | Refresh token com rotação + reuse detection (lookup O(1) via digest) |
| POST | `/auth/forgot-password` | — | 5/min | Solicita token de reset (retorna `resetToken` **apenas fora de produção**) |
| POST | `/auth/reset-password` | — | 5/min | Redefine senha com `email` + token |
| GET | `/auth/me` | JWT | — | Perfil do usuário logado |
| PATCH | `/auth/me` | JWT | — | Atualizar nome, email ou senha (exige `currentPassword` para trocar senha) |
| POST | `/auth/logout` | JWT | — | Revoga todos os refresh tokens do usuário |

> **Fluxo de recuperação de senha:** `forgotPassword` retorna o `resetToken` no corpo da resposta **apenas quando `NODE_ENV !== 'production'`** (útil para dev/teste manual). Em produção retorna uma mensagem neutra (`If that email exists, a reset token has been generated`). `resetPassword` exige `email` + `token` + `password` e valida o digest com vínculo ao e-mail.

### Usuários (`/users`) — ADMIN only

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users` | Listar todos os usuários |
| GET | `/users/:id` | Buscar usuário por ID |
| POST | `/users` | Criar novo usuário (pode definir `role`) |
| PATCH | `/users/:id` | Atualizar dados de um usuário |
| DELETE | `/users/:id` | Remover usuário (bloqueado se houver movimentações; auto-delete proibido) |

### Produtos (`/products`)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/products` | * | Listar todos os produtos |
| GET | `/products/:id` | * | Buscar produto por ID |
| POST | `/products` | ADMIN, TECHNICIAN | Criar produto |
| PATCH | `/products/:id` | ADMIN, TECHNICIAN | Atualizar produto |
| DELETE | `/products/:id` | ADMIN | Remover produto (bloqueado se houver movimentações/estoque) |
| POST | `/products/:id/image` | ADMIN, TECHNICIAN | Upload/substituir imagem (max 5 MB) |
| DELETE | `/products/:id/image` | ADMIN, TECHNICIAN | Remover imagem |

### Estoque Central (`/central-stock`)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/central-stock` | * | Listar estoque com dados do produto (name, category, image) |
| GET | `/central-stock/:productId` | * | Buscar saldo de um produto |
| PATCH | `/central-stock/:productId` | ADMIN, TECHNICIAN | Ajustar quantidade (valor absoluto, `>= 0`) |

### Padrão de Frigobar (`/minibar-standard`)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/minibar-standard/rooms` | * | Listar quartos disponíveis (101–110) |
| GET | `/minibar-standard/:room` | * | Listar padrão do quarto |
| POST | `/minibar-standard/:room` | ADMIN, TECHNICIAN | Adicionar/substituir item (upsert) |
| PATCH | `/minibar-standard/:room/:productId` | ADMIN, TECHNICIAN | Atualizar quantidade padrão |
| DELETE | `/minibar-standard/:room/:productId` | ADMIN, TECHNICIAN | Remover item do padrão (204) |

### Movimentações (`/stock-movements`)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/stock-movements` | * | Listar movimentações (filtros: `type`, `room`, `from`, `to`, `page`, `limit`) |
| POST | `/stock-movements/in` | ADMIN, TECHNICIAN | Registrar entrada de mercadorias (batch) |
| POST | `/stock-movements/replenish/:room` | * | Reposição de frigobar (cria CONSUMPTION + REPLENISH, deduz do estoque central atomicamente) |
| POST | `/stock-movements/meal-out` | * | Retirada de marmita (`description` obrigatório, deduz do estoque central atomicamente) |

As operações de débito validam o saldo **dentro da transação** com `UPDATE ... WHERE quantity >= amount` — se insuficiente, respondem `400` com mensagem em português (`Estoque insuficiente para <produto>: disponível X, necessário Y`) e desfazem todos os registros da transação.

### Dashboard (`/dashboard`)

> `*` = ADMIN, TECHNICIAN, OPERATOR. Dashboard é restrito a ADMIN/TECHNICIAN.

#### Sumário e Relatórios

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/dashboard/summary` | ADMIN, TECHNICIAN | Totais (produtos via `count(*)`, itens), alertas de estoque baixo, movimentações do dia |
| GET | `/dashboard/consumption-by-room` | ADMIN, TECHNICIAN | Consumo agrupado por quarto (filtros: `from`, `to`) |
| GET | `/dashboard/consumption-by-room/csv` | ADMIN, TECHNICIAN | Exportar CSV do consumo por quarto |
| GET | `/dashboard/consumption-by-room/pdf` | ADMIN, TECHNICIAN | Exportar PDF do consumo por quarto |
| GET | `/dashboard/meal-ranking` | ADMIN, TECHNICIAN | Ranking de marmitas mais consumidas (filtros: `from`, `to`, `limit`) |
| GET | `/dashboard/meal-ranking/csv` | ADMIN, TECHNICIAN | Exportar CSV do ranking de marmitas |
| GET | `/dashboard/meal-ranking/pdf` | ADMIN, TECHNICIAN | Exportar PDF do ranking de marmitas |
| GET | `/dashboard/stock-history/:productId` | ADMIN, TECHNICIAN | Histórico de movimentações com saldo acumulado (`runningBalance`) |
| GET | `/dashboard/stock-history/:productId/csv` | ADMIN, TECHNICIAN | Exportar CSV do histórico do produto |
| GET | `/dashboard/stock-history/:productId/pdf` | ADMIN, TECHNICIAN | Exportar PDF do histórico do produto |

#### Charts (dados para gráficos)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/dashboard/charts/monthly-consumption` | ADMIN, TECHNICIAN | Consumo mensal (REPLENISH vs MEAL_OUT) para gráfico de linha |
| GET | `/dashboard/charts/room-comparison` | ADMIN, TECHNICIAN | Comparativo de consumo por quarto para gráfico de barras |
| GET | `/dashboard/charts/category-distribution` | ADMIN, TECHNICIAN | Distribuição do estoque por categoria (BEVERAGE vs MEAL) para gráfico de pizza |
| GET | `/dashboard/charts/stock-evolution/:productId` | ADMIN, TECHNICIAN | Evolução do saldo ao longo do tempo para gráfico de linha |

## Frontend — Web App

### Páginas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Landing Page | Página inicial animada com `framer-motion` |
| `/login` | Login | Autenticação com email + senha |
| `/register` | Register | Cadastro de novo usuário |
| `/recuperar-senha` | Forgot Password | Solicitação de reset de senha |
| `/redefinir-senha` | Reset Password | Redefinição de senha com token |
| `/app/dashboard` | Dashboard | Sumário, alertas, charts (consumo mensal, por quarto, distribuição) |
| `/app/produtos` | Products | CRUD de produtos com upload de imagem |
| `/app/estoque-central` | Central Stock | Visualização e ajuste do estoque central |
| `/app/padrao-frigobar` | Minibar Standard | Gerenciamento do padrão de frigobar por quarto |
| `/app/movimentacoes` | Stock Movements | Listagem e registro de movimentações |
| `/app/usuarios` | Users | CRUD de usuários (admin only) |
| `/app/perfil` | Profile | Edição do perfil do usuário logado |
| `*` | NotFound | Página 404 |

> Todas as rotas `/app/*` são protegidas por `ProtectedRoute` (redireciona para `/login` se não autenticado). A sessão é hidratada via `GET /auth/me` no carregamento.

### Design System

- **Tema:** Suporte a `light` e `dark` mode com detecção de preferência do SO e persistência em `localStorage`
- **Paleta:** Navy (azul escuro) + Gold (dourado) — cores CSS personalizadas via `@theme` do Tailwind v4
- **Componentes UI Primitivos:** `Button`, `Input`, `Select`, `Badge`, `Card`, `Dialog`, `Label`, `Skeleton`, `Spinner`, `PasswordInput`, `ErrorBanner` — todos com suporte a tema
- **Gráficos:** `BarChart` em SVG puro (sem dependências de chart)
- **Animações:** `framer-motion` para transições de página e micro-interações
- **Ícones:** `lucide-react`

### Tratamento de Erros

- Helper `getApiErrorMessage(err)` em `apps/web/src/lib/api-error.ts` — extrai a mensagem do backend (string ou array de validação Zod), com fallback para erros de rede e genéricos
- Componente `ErrorBanner` reutilizável e dismissível, aplicado em todas as páginas de operação (movimentações, estoque, produtos, usuários, minibar) e nos erros de download do dashboard

### Arquitetura Frontend

```
src/
├── components/
│   ├── layout/          # AppLayout, AuthLayout, PublicLayout
│   ├── landing/         # Componentes da landing page (Hero, Features, etc.)
│   ├── shared/          # BarChart (SVG puro), ProtectedRoute, ThemeToggle
│   ├── stock/           # Componentes específicos de estoque
│   └── ui/              # Primitivos: Button, Input, Select, Card, Badge, Dialog, ErrorBanner, etc.
├── contexts/
│   ├── auth-context.tsx  # Provider com login, register, logout, hidratação de sessão
│   └── theme-context.tsx # Provider com toggle light/dark
├── hooks/
│   ├── queries/          # React Query hooks por domínio
│   └── use-download-report.ts  # Download de relatórios (CSV/PDF)
├── lib/
│   ├── api.ts            # Axios instance com interceptors (JWT + silent refresh + 401 redirect)
│   ├── api-error.ts      # getApiErrorMessage helper
│   └── utils.ts          # formatDate, formatDateShort, cn()
├── pages/
│   ├── app/              # Dashboard, Products, CentralStock, Minibar, Movements, Users, Profile
│   ├── auth/             # Login, Register, ForgotPassword, ResetPassword
│   ├── landing.tsx
│   └── not-found.tsx
├── routes.tsx            # Definição de rotas (createBrowserRouter + ProtectedRoute)
└── types/                # auth.ts, product.ts, stock.ts, dashboard.ts
```

### Gerenciamento de Estado

- **Server state:** `@tanstack/react-query` — queries e mutations por domínio (auth, products, stock, movements, dashboard, minibar)
- **Auth state:** React Context (`AuthProvider`) com tokens em `localStorage` e hidratação de sessão via `/auth/me`
- **Silent refresh:** Interceptor do axios renova o access token em 401 (single-flight com fila de requisições pendentes) — a sessão **não cai** a cada 15min
- **Theme:** React Context (`ThemeProvider`) com `localStorage` + `prefers-color-scheme`
- **Formulários:** `react-hook-form` com validação Zod via `@hookform/resolvers`

## Segurança

| Medida | Detalhes |
|--------|----------|
| **Registro seguro** | `/auth/register` ignora `role` (sempre `OPERATOR`) — sem escalação de privilégio |
| **JWT_SECRET validado** | `config/env.ts` lança erro em produção se `JWT_SECRET` ausente/vazio/`dev-secret`/< 32 chars |
| **Sessão única** | Ao fazer login, todos os refresh tokens anteriores do usuário são revogados |
| **Logout** | Revoga todos os refresh tokens — seguro para dispositivos compartilhados |
| **Access token** | JWT stateless, expira em 15 minutos |
| **Refresh token** | Opaque random hex (48 bytes), digest `sha256` indexado no banco (lookup O(1)), expira em 7 dias, rotação a cada uso |
| **Reuse detection** | Se um refresh token for reutilizado (roubado), a rotação falha e a sessão é invalidada |
| **Rate limit** | `@nestjs/throttler` por IP: login/refresh 30/min, register 10/min, forgot/reset 5/min, fallback global 100/min |
| **Headers de segurança** | `@fastify/helmet` (CSP desativado — API serve JSON/Swagger a outra origem) |
| **Silent refresh** | Frontend renova o token automaticamente em 401; falha no refresh → logout com redirecionamento |
| **Senhas** | bcrypt com salt rounds = 10 |
| **Troca de senha** | Exige `currentPassword` (obrigatório) e rejeita senha igual à atual |
| **Recuperação de senha** | Token vinculado ao e-mail; `resetToken` nunca exposto em produção; lookup O(1) |
| **Deletes seguros** | Bloqueio de exclusão de usuário/produto com movimentações (mensagem clara); auto-delete proibido |
| **FK violations** | `AllExceptionsFilter` converte erro Postgres `23503` em `409 Conflict` amigável |
| **CSV seguro** | Valores iniciando com `=`, `+`, `-`, `@` são prefixados com `'` (anti formula injection) |
| **Validação** | Zod schemas em todas as entradas, pipe global `ZodValidationPipe` |
| **Upload** | Limite de 5 MB por arquivo, extensão derivada do MIME type |
| **CORS** | Configurável via `CORS_ORIGIN` (default: `http://localhost:5173`) |
| **Tratamento de erros** | `AllExceptionsFilter` global — respostas padronizadas + logs no servidor |

## Armazenamento

Interface `StorageService` com implementação `LocalStorageService` (sistema de arquivos local). Uploads salvos em `UPLOAD_DIR` com nomes UUID únicos e servidos estaticamente em `/uploads`. A interface permite substituição futura por S3/Cloudflare R2 sem alterar os controllers.

## Testes

### Backend (Jest + Supertest)

- **Testes unitários:** Por service (`*.spec.ts`), timeout 30s (bcrypt), inclui `env.spec.ts` (validação de config) e `all-exceptions.filter.spec.ts`
- **Testes e2e:** Pasta `apps/api/test/`, banco isolado `nutrigest_test` (porta 5434), helper compartilhado `helpers/auth.helper.ts`, inclui `throttle.e2e-spec.ts` (rate limit 429)
- **Setup:** Carrega `.env.test` com `dotenv`

```bash
pnpm --filter @nutrigest/api test            # Unitários
pnpm --filter @nutrigest/api test:e2e        # E2E
pnpm --filter @nutrigest/api test:watch      # Watch mode
pnpm --filter @nutrigest/api test:cov        # Com cobertura
```

### Frontend (Vitest + Testing Library)

- **Unitários:** Componentes UI primitivos (`*.test.tsx`) + `api-error.test.ts` (helper) + `api.test.ts` (interceptor silent refresh) + `protected-route.test.tsx` + `auth-context.test.tsx`
- **Setup:** jsdom, CSS modules, `@testing-library/jest-dom`

```bash
pnpm --filter @nutrigest/web test             # Vitest
pnpm --filter @nutrigest/web test:watch       # Watch mode
pnpm --filter @nutrigest/web test:ui          # Vitest UI
```

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Docker** + **Docker Compose** (para PostgreSQL)

## Setup Rápido

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

# 5. Popule dados iniciais (cria admin + produtos de exemplo)
pnpm --filter @nutrigest/api seed

# 6. Inicie a API e o frontend (em terminais separados)
pnpm dev:api   # http://localhost:3000
pnpm dev:web   # http://localhost:5173
```

A API estará em **http://localhost:3000** (todos os endpoints sob `/api`) e o Swagger em **http://localhost:3000/api**.

Usuário admin padrão: `admin@nutrigest.com` / `Admin@123`

## Variáveis de Ambiente

```env
# apps/api/.env
DATABASE_URL=postgresql://nutrigest:nutrigest@localhost:5434/nutrigest
PORT=3000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=<seu-secret>
JWT_REFRESH_SECRET=<seu-refresh-secret>   # reservado (não usado no código hoje)
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

> **Atenção em produção:** `NODE_ENV=production` exige `JWT_SECRET` com no mínimo 32 caracteres e diferente de `dev-secret` — caso contrário a API **não inicia** (proteção contra tokens forjados).

## Comandos

### Desenvolvimento

```bash
pnpm dev:api            # Inicia API em http://localhost:3000 (watch mode)
pnpm dev:web            # Inicia Web em http://localhost:5173 (Vite)
pnpm build:api          # Build da API (NestJS)
pnpm build:web          # Build do frontend (TypeScript + Vite)
```

### Lint / Format

```bash
pnpm lint               # Biome check (read-only)
pnpm format             # Biome check --write (aplica correções)
pnpm lint:ci            # Biome ci (modo estrito para CI)
```

### Banco de Dados

```bash
pnpm --filter @nutrigest/api exec drizzle-kit generate   # Gera migração
pnpm --filter @nutrigest/api exec drizzle-kit migrate    # Aplica migração
pnpm --filter @nutrigest/api exec drizzle-kit studio     # Drizzle Studio (GUI)
pnpm --filter @nutrigest/api seed                        # Popula admin + produtos
pnpm --filter @nutrigest/api db:test:setup               # Cria banco de test + migra
```

### Docker

```bash
docker compose up -d    # Sobe PostgreSQL na porta 5434
docker compose down     # Para serviços
docker compose down -v  # Para serviços + remove volume (limpa dados)
```

## Estrutura do Projeto

```
nutrigest/
├── apps/
│   ├── api/                          # NestJS + Fastify + Drizzle ORM
│   │   ├── src/
│   │   │   ├── auth/                 # Auth (JWT, refresh, reset) + throttler + guards + strategies
│   │   │   ├── users/                # CRUD de usuários (admin)
│   │   │   ├── products/             # CRUD de produtos + upload de imagem
│   │   │   ├── central-stock/        # Estoque central (operações atômicas)
│   │   │   ├── minibar-standard/     # Padrão de frigobar por quarto
│   │   │   ├── stock-movements/      # Movimentações (IN, CONSUMPTION, REPLENISH, MEAL_OUT)
│   │   │   ├── dashboard/            # Sumário, relatórios, charts, CSV export, PDF export
│   │   │   ├── config/               # Validação de ambiente (getJwtSecret)
│   │   │   ├── db/                   # Conexão Drizzle (pg Pool) + schemas + migrations + seed
│   │   │   ├── storage/              # Abstração de armazenamento (interface + local impl)
│   │   │   └── common/               # Adapters, decorators (@CurrentUser, @Roles), filters (AllExceptionsFilter)
│   │   ├── test/                     # Testes e2e (auth, users, products, stock, dashboard, minibar, throttle) + helpers
│   │   ├── drizzle/                  # Migrations geradas pelo Drizzle Kit
│   │   ├── .env.example
│   │   └── .env.test
│   └── web/                          # React + Vite + TypeScript + Tailwind CSS v4
│       ├── src/
│       │   ├── components/           # UI primitives, layout, shared (BarChart, ProtectedRoute), stock
│       │   ├── contexts/             # AuthProvider, ThemeProvider
│       │   ├── hooks/queries/        # React Query hooks (auth, products, stock, movements, dashboard, minibar)
│       │   ├── lib/                  # API client (axios + silent refresh), api-error, utils
│       │   ├── pages/                # App pages (7), Auth pages (4), Landing, NotFound
│       │   ├── routes.tsx            # Rotas (createBrowserRouter)
│       │   ├── types/                # TypeScript interfaces (auth, product, stock, dashboard)
│       │   └── test/                 # Test setup (vitest)
│       └── vite.config.ts           # Vite config with proxy (/api, /uploads) + Tailwind plugin
├── packages/
│   └── shared/                       # Constantes compartilhadas (VALID_ROOMS, LOW_STOCK_THRESHOLD) + enums
├── docs/
│   ├── AGENTS.md                     # Regras de desenvolvimento (opencode)
│   ├── TODO.md                       # Roadmap do projeto
│   └── superpowers/
│       ├── specs/                    # Especificações técnicas (design docs)
│       └── plans/                    # Planos de implementação
├── docker-compose.yml                # PostgreSQL 16 Alpine
├── biome.json                        # Biome config (linter + formatter)
├── pnpm-workspace.yaml               # Monorepo config
└── package.json                      # Root scripts
```

## Desenvolvimento

### Workflow Git

1. Crie uma branch: `git checkout -b feat/nome-da-feature dev` (ou `fix/`/`docs/`)
2. Desenvolva seguindo TDD (testes → implementação)
3. Commit por sub-feature: `feat:`, `test:`, `fix:`, `docs:`, `refactor:`
4. Abra PR no GitHub: `feat/nome-da-feature` → `dev`
5. Após aprovação manual, faça merge em `dev`
6. `dev` → `main` apenas quando a fase estiver completa e testada

### Padrão de Implementação (cada feature)

1. Schema Drizzle + migração
2. DTOs com validação Zod
3. Service com lógica de negócio
4. Controller com decorators Swagger (OpenAPI)
5. Testes unitários (Jest) — timeout 30s
6. Testes e2e (Supertest) — timeout 30s
7. Seed data (se aplicável)
8. Lint + Build + Testes passando

### Convenções

- **TDD:** Testes primeiro, implementação depois
- **Feature-first:** Cada feature implementada, testada e aprovada antes da próxima
- **Backend-first:** API completa antes do frontend
- **Spec-driven:** Toda feature documentada em `docs/superpowers/specs/`
- **Mobile-first:** Todo layout frontend responsivo, priorizando dispositivos móveis (celulares/tablets)
- **Swagger:** Toda rota documentada com decorators OpenAPI
- **Commits convencionais:** `feat:`, `fix:`, `test:`, `docs:`, `refactor:`

### Ambiente de Teste

Banco isolado `nutrigest_test` na porta 5434:

```bash
# Setup inicial (1 vez)
pnpm --filter @nutrigest/api db:test:setup

# Rodar testes
pnpm --filter @nutrigest/api test          # Unitários
pnpm --filter @nutrigest/api test:e2e      # E2E
pnpm --filter @nutrigest/api test:cov      # Com cobertura
```

## Licença

UNLICENSED — Projeto privado.

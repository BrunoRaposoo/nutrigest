# Nutrigest — Sistema de Controle de Estoque Nutricional

## Problema

A nutricionista controla o estoque de bebidas (frigobares dos leitos 101-110) e marmitas usando papel. As copeiras anotam traços para cada retirada de marmita, sem rastreabilidade. A reposição dos frigobares é registrada de forma precária. Não há visibilidade em tempo real do saldo de marmitas para planejar pedidos ao fornecedor. O processo é vulnerável a erros e não atende auditoria.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite + TypeScript + Tailwind CSS v4 + React Query + React Hook Form + Zod |
| Backend | NestJS + Fastify + Drizzle ORM |
| Banco | PostgreSQL (porta 5434) |
| Auth | JWT + bcrypt |
| Infra | Docker Compose |

## Modelo de Dados

### User
- id, name, email (unique), passwordHash, role (ADMIN | TECHNICIAN | OPERATOR), timestamps

### Product
- id, name, category (BEVERAGE | MEAL), unit (default "un")

### CentralStock
- productId (FK, unique), quantity (default 0), updatedAt

### MinibarStandard
- room (101-110), productId (FK), standardQuantity
- Unique constraint: (room, productId)

### StockMovement
- id, type (IN | REPLENISH | MEAL_OUT), productId (FK), quantity (positive), room (nullable, only for REPLENISH), userId (FK), description (nullable), createdAt

## Fluxos Principais

### Reposição de Frigobar
1. Operador seleciona quarto (101-110)
2. Sistema exibe produtos do padrão com campos de consumo
3. Operador preenche quantidades consumidas
4. Backend: valida saldo, cria movimentos REPLENISH, deduz do CentralStock

### Retirada de Marmita
1. Tela rápida com lista de produtos MEAL e saldo atual
2. Botão -1 ou campo numérico + "Retirar"
3. Backend: cria movimento MEAL_OUT, atualiza CentralStock

### Entrada de Estoque
1. Tela para ADMIN/TECHNICIAN registrar nota de entrada
2. Selecionar múltiplos produtos e quantidades
3. Backend: cria movimentos IN, atualiza CentralStock

## Funcionalidades MVP

- Autenticação JWT com guards por role
- CRUD de produtos
- Definição de padrão de frigobar por quarto
- Entrada de mercadorias
- Reposição de frigobar (mobile-first)
- Retirada de marmita
- Dashboard com saldos e alertas
- Relatórios de consumo por quarto e ranking de marmitas
- Logs de auditoria

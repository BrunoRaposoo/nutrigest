# Product Images — Design Doc

## Contexto

Adicionar suporte opcional a imagens no cadastro de produtos do Nutrigest para facilitar a visualização e identificação dos itens no dia a dia da nutrição hospitalar.

## Storage

Optou-se por armazenamento local via `@fastify/static` em vez de Cloudflare R2, dado o porte atual do sistema (~8 usuários, ~12-50 produtos, sem previsão de escalar). O design usa uma interface abstrata `StorageService` para permitir migração futura para R2/S3 sem impacto no resto do sistema.

## Stack

- `@fastify/multipart` — receber upload de arquivos no Fastify
- `@fastify/static` — servir arquivos estaticamente (já instalado)
- `sharp` — (futuro) redimensionamento de imagens se necessário

## Schema

### products (alteração)

Adicionar coluna opcional:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `imageUrl` | `text`, nullable | Caminho relativo da imagem (ex: `/uploads/uuid.ext`) |

Migração gerada com `drizzle-kit generate`.

## Arquitetura

### StorageService (abstração)

```
apps/api/src/storage/
├── storage.service.ts         # Interface/abstract class
├── local-storage.service.ts   # Implementação local
└── storage.module.ts          # Module com providers
```

**Interface:**

```typescript
export interface StorageService {
  upload(file: File): Promise<string>;
  delete(url: string): Promise<void>;
}
```

- `upload`: recebe arquivo do multipart, salva em `UPLOAD_DIR` com nome único (`uuid.ext`), retorna URL relativa
- `delete`: recebe URL relativa, remove arquivo do disco
- Injeção via token `'STORAGE_SERVICE'` no NestJS

### Validações de upload

- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`
- Tamanho máximo: 5MB (configurável via `MAX_FILE_SIZE`)
- Produtos sem imagem permanecem com `imageUrl: null`

## Endpoints

### Novos endpoints de imagem

| Método | Rota | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| POST | `/products/:id/image` | JWT | ADMIN, TECHNICIAN | Upload/substituir imagem |
| DELETE | `/products/:id/image` | JWT | ADMIN, TECHNICIAN | Remover imagem |

### POST /products/:id/image

- Content-Type: `multipart/form-data`
- Campo `file`: arquivo de imagem
- Regras:
  - Produto deve existir (404 caso contrário)
  - Se produto já tem imagem, deleta a anterior antes de salvar a nova
  - Valida tipo e tamanho do arquivo
- Resposta: `200 OK` com produto atualizado (incluindo `imageUrl`)

### DELETE /products/:id/image

- Produto deve existir (404 caso contrário)
- Se produto não tem imagem, retorna 200 (idempotente)
- Deleta arquivo do disco + seta `imageUrl = null`
- Resposta: `200 OK` com produto atualizado

### Endpoints existentes (sem alteração)

- POST /products — continua JSON, imagem é adicionada depois via endpoint dedicado
- PATCH /products/:id — continua JSON, sem campo image
- DELETE /products/:id — se produto tiver imagem, chama `StorageService.delete()` antes de remover o registro

## Configuração

### `.env`

```
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

### main.ts

Registrar plugins Fastify:

```typescript
app.register(fastifyStatic, {
  root: join(__dirname, '..', uploadDir),
  prefix: '/uploads/',
  decorateReply: false,
});

app.register(fastifyMultipart, {
  limits: { fileSize: MAX_FILE_SIZE },
});
```

### `.gitignore`

```
uploads/*
!uploads/.gitkeep
```

## Produtos alterados

| Arquivo | Ação |
|---------|------|
| `src/db/schema/products.ts` | Adicionar coluna `imageUrl` |
| `src/db/seed-runner.ts` | Adicionar campo vazio nos seeds |
| `src/storage/storage.service.ts` | NOVO — interface |
| `src/storage/local-storage.service.ts` | NOVO — implementação |
| `src/storage/storage.module.ts` | NOVO — módulo |
| `src/products/dto/create-product.dto.ts` | Incluir `imageUrl` no type |
| `src/products/dto/update-product.dto.ts` | Incluir `imageUrl` no type |
| `src/products/products.service.ts` | Adicionar uploadImage + deleteImage |
| `src/products/products.controller.ts` | Adicionar 2 endpoints + Swagger |
| `src/products/products.module.ts` | Importar StorageModule |
| `src/products/products.service.spec.ts` | NOVOS testes unitários |
| `test/products.e2e-spec.ts` | NOVOS testes e2e |
| `src/main.ts` | Registrar fastifyStatic + fastifyMultipart |
| `docs/AGENTS.md` | Atualizar tabela de endpoints |
| `docs/TODO.md` | Marcar sub-feature |
| `.gitignore` | Ignorar uploads/ |
| `.env` | Adicionar UPLOAD_DIR, MAX_FILE_SIZE |

## Testes

### Unitários (ProductsService)

- `uploadImage`: faz upload com arquivo válido → retorna produto com imageUrl
- `uploadImage`: produto não encontrado → throw NotFoundException
- `uploadImage`: produto já com imagem → substitui (chama delete da antiga)
- `deleteImage`: remove imagem → imageUrl fica null
- `deleteImage`: produto sem imagem → retorna produto (idempotente)
- `deleteImage`: produto não encontrado → throw NotFoundException
- `remove`: produto com imagem → chama storage.delete antes de deletar registro

### E2E

- Upload como ADMIN → 200
- Upload como TECHNICIAN → 200
- Upload como OPERATOR → 403
- Upload sem autenticação → 401
- Upload de arquivo inválido → 400
- Delete imagem → 200 + imageUrl = null
- Delete imagem inexistente → 200 (idempotente)
- GET produto após upload → retorna imageUrl

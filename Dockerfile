FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY tsconfig*.json ./
RUN pnpm build:api && pnpm build:web

RUN pnpm deploy --legacy --filter @nutrigest/api /app/deploy && \
    cp -r apps/api/dist /app/deploy/dist && \
    cp -r apps/web/dist /app/deploy/public && \
    cp apps/api/drizzle.config.ts /app/deploy/ && \
    cp -r apps/api/drizzle/. /app/deploy/drizzle/

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /app/deploy ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD curl -f http://localhost:3000/api-json || exit 1

CMD ["node", "dist/src/main"]

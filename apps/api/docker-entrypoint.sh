#!/bin/sh
set -e
echo "[entrypoint] Running drizzle migrations..."
npx drizzle-kit migrate || { echo "[entrypoint] migrate failed"; exit 1; }
echo "[entrypoint] Migrations ok. Attempting seed (idempotent)..."
node dist/src/db/seed-runner.js || echo "[entrypoint] seed skipped/failed (non-fatal)"
echo "[entrypoint] Starting API..."
exec node dist/src/main

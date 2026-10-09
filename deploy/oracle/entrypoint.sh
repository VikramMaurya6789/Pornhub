#!/bin/sh
# Container startup: wait for Postgres, apply Prisma schema, start Next.js.
set -e

echo "[entrypoint] Waiting for Postgres and applying schema..."
for i in $(seq 1 30); do
  if npx prisma db push --skip-generate; then
    echo "[entrypoint] Schema OK."
    break
  fi
  echo "[entrypoint] DB not ready yet (attempt $i/30), retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Starting Next.js on :3000"
exec npx next start -p 3000 -H 0.0.0.0

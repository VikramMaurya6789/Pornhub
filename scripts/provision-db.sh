#!/usr/bin/env bash
# Provision the OrangeHub Postgres DB: runs Prisma migrations and verifies tables.
# Usage: POSTGRES_URL="postgres://..." bash scripts/provision-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${POSTGRES_URL:-}" ]; then
  echo "ERROR: POSTGRES_URL is not set."
  exit 1
fi

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Verifying tables..."
node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasourceUrl: process.env.POSTGRES_URL });
const tables = ['user','session','comment','favorite','watchHistory','videoStat','playlist','playlistItem','feedCache','videoCache','searchLog','report'];
for (const t of tables) {
  const n = await prisma[t].count();
  console.log('  ' + t + ': ' + n + ' rows');
}
await prisma.\$disconnect();
console.log('DB OK');
"

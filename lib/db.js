import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function getValidConnectionString() {
  const candidates = [
    process.env.POSTGRES_PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.NETLIFY_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.PORNHUB_POSTGRES_URL,
    process.env.PORNHUB_DATABASE_URL,
    process.env.PORNHUB_PRISMA_DATABASE_URL,
    process.env.POSTGRES_DATABASE_URL,
    process.env.NEON_DATABASE_URL,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && (c.startsWith('postgres://') || c.startsWith('postgresql://')) && !c.includes('[SENSITIVE]')) {
      return c;
    }
  }

  // Wasmer Edge PostgreSQL: construct from individual parts
  // (Wasmer exposes DB_HOST, DB_NAME, DB_USERNAME, DB_PORT, DB_PASSWORD)
  const wh = process.env.DB_HOST;
  const wn = process.env.DB_NAME;
  const wu = process.env.DB_USERNAME;
  const wp = process.env.DB_PORT;
  const ws = process.env.DB_PASSWORD;
  if (wh && wn && wu && wp && ws) {
    return `postgresql://${encodeURIComponent(wu)}:${encodeURIComponent(ws)}@${wh}:${wp}/${wn}?sslmode=require`;
  }
  return undefined;
}

const connectionString = getValidConnectionString();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(connectionString ? { datasourceUrl: connectionString } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

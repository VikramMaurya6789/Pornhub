import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function getValidConnectionString() {
  const candidates = [
    process.env.POSTGRES_PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.PORNHUB_POSTGRES_URL,
    process.env.PORNHUB_DATABASE_URL,
    process.env.PORNHUB_PRISMA_DATABASE_URL,
    process.env.POSTGRES_DATABASE_URL,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && (c.startsWith('postgres://') || c.startsWith('postgresql://')) && !c.includes('[SENSITIVE]')) {
      return c;
    }
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

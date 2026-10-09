// Cloudflare D1 database interface (Prisma-compatible shape).
// Replaces the old PrismaClient/Postgres binding. All existing call sites
// (`import prisma from './db.js'` then `prisma.user.findUnique(...)`) keep
// working unchanged — queries now hit the D1 binding "DB" via lib/d1.js.
import { getDb } from './d1.js';

export const prisma = getDb();

export default prisma;

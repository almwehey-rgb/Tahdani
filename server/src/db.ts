import { PrismaClient } from '@prisma/client';

// Serverless functions can be re-invoked in the same warm process, so we
// cache the client on `global` to avoid opening a fresh pool of Postgres
// connections on every invocation (the classic Prisma + serverless pitfall).
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

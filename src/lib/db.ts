import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.PRISMA_LOG_QUERIES === 'true'
      ? { log: [{ emit: 'event', level: 'query' }] }
      : {}
  )

// Prisma query logging can be extremely noisy (and can grow logs very quickly).
// Keep it opt-in via env vars:
// - PRISMA_LOG_QUERIES=true to enable
// - PRISMA_LOG_SLOW_MS=200 to only log queries slower than 200ms
if (process.env.PRISMA_LOG_QUERIES === 'true') {
  const slowMs = Number(process.env.PRISMA_LOG_SLOW_MS || '0');
  db.$on('query', (e) => {
    const durationMs = (e as any).duration as number | undefined;
    if (slowMs > 0 && typeof durationMs === 'number' && durationMs < slowMs) return;

    const durationSuffix = typeof durationMs === 'number' ? ` (${durationMs}ms)` : '';
    logger.debug('db', `${e.query}${durationSuffix} ${e.params}`);
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
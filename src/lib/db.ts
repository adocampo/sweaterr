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

// SQLite (especially on NAS / HDD bind mounts) can suffer from high latency and locking.
// We apply a few conservative PRAGMAs to reduce lock contention and "socket timeout" errors.
// These are best-effort and safe to ignore if the database is not SQLite.
const sqliteInitPromise = (async () => {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:')) return;

  const busyTimeoutMs = Number(process.env.SQLITE_BUSY_TIMEOUT_MS || '15000');
  const journalModeRaw = (process.env.SQLITE_JOURNAL_MODE || 'WAL').toUpperCase();
  const synchronousRaw = (process.env.SQLITE_SYNCHRONOUS || 'NORMAL').toUpperCase();

  const journalMode = ['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF'].includes(journalModeRaw)
    ? journalModeRaw
    : 'WAL';
  const synchronous = ['OFF', 'NORMAL', 'FULL', 'EXTRA'].includes(synchronousRaw)
    ? synchronousRaw
    : 'NORMAL';

  try {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    await db.$executeRawUnsafe(`PRAGMA journal_mode = ${journalMode};`);
    await db.$executeRawUnsafe(`PRAGMA synchronous = ${synchronous};`);
    if (Number.isFinite(busyTimeoutMs) && busyTimeoutMs > 0) {
      await db.$executeRawUnsafe(`PRAGMA busy_timeout = ${Math.floor(busyTimeoutMs)};`);
    }
    logger.info('db', `SQLite PRAGMAs applied (journal_mode=${journalMode}, synchronous=${synchronous}, busy_timeout=${busyTimeoutMs}ms)`);
  } catch (err) {
    logger.warn('db', `Failed to apply SQLite PRAGMAs: ${err}`);
  }
})();

export async function ensureDbReady(): Promise<void> {
  await sqliteInitPromise;
}

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
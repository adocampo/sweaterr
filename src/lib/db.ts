import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ emit: 'event', level: 'query' }],
  })

// Redirect Prisma query logs to dedicated file instead of stdout
db.$on('query', (e) => {
  logger.info('db', `${e.query} ${e.params}`)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
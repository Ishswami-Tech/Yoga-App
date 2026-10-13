import { PrismaClient } from '@prisma/client'

// Serverless-safe singleton: one PrismaClient per runtime instance, cached on
// globalThis (also across hot reloads in dev). On Vercel set DATABASE_URL to the
// *pooled* connection string (Neon "pooled", Supabase transaction pooler on
// port 6543 with `?pgbouncer=true&connection_limit=1`).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })

globalForPrisma.prisma = db

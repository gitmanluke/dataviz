import "server-only"
import { PrismaClient } from "@prisma/client"

// Reuse a single PrismaClient across hot-reloads in dev, otherwise every reload
// opens a new connection pool. https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

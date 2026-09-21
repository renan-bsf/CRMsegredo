import "server-only";
import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Banco não configurado.");
  if (!globalDb.prisma) globalDb.prisma = new PrismaClient({ log: [] });
  return globalDb.prisma;
}

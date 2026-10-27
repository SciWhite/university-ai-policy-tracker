import { PrismaClient } from "./prisma-client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseConnection } from "./connection.js";

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const { pool, schema, transactionOptions } = getDatabaseConnection();
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }), transactionOptions });
  }
  return prisma;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prisma) return;

  await prisma.$disconnect();
  prisma = undefined;
}

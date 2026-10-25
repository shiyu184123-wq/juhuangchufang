import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 单例：防止 Next.js 热更新时重复创建连接。
// Prisma ORM 7 的 SQL 路径必须显式注入 driver adapter，所以这里比旧写法多一层 adapter；
// 读取的 DATABASE_URL 与 prisma7.config.ts 是同一个（.env.local）。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
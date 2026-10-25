import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 单例：防止 Next.js 热更新时重复创建连接。
// Prisma ORM 7 的 SQL 路径必须显式注入 driver adapter，所以这里比旧写法多一层 adapter。
// 连接串只从 DATABASE_URL 读取（配置在项目根目录的 .env.local），不做任何 fallback：
// 漏配时静默落回本地文件，会表现为"线上数据莫名丢失"，宁可启动即报错。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "缺少环境变量 DATABASE_URL。请在项目根目录的 .env.local 中配置数据库连接串" +
        '（本地开发示例：DATABASE_URL="file:./prisma/dev.db"）；' +
        "本文件不再提供默认值，避免生产环境漏配时静默连到本地库导致数据丢失。",
    );
  }

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
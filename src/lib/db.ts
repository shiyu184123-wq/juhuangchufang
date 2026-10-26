import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Prisma 单例：防止 Next.js 热更新时重复创建连接。
// Prisma ORM 7 的 SQL 路径必须显式注入 driver adapter，所以这里比旧写法多一层 adapter。
// 连接串只从 DATABASE_URL 读取（配置在项目根目录的 .env.local），不做任何 fallback：
// 漏配时静默落回本地文件，会表现为"线上数据莫名丢失"，宁可启动即报错。
//
// P0-06 起数据库从 SQLite 换成 Neon 托管的 Postgres（见 DECISIONS D-018）：
// 用 @prisma/adapter-neon（底层 @neondatabase/serverless，WebSocket 连接），
// 这是 Vercel + Neon 官方推荐的 Prisma 7 组合，serverless 下不会打满普通 TCP 连接池。
// 本文件只负责 adapter 注入与报错文案，不包含任何业务逻辑。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "缺少环境变量 DATABASE_URL。请在项目根目录的 .env.local 中配置 Neon 连接串" +
        '（示例：DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"）；' +
        "本文件不再提供默认值，避免生产环境漏配时静默连到本地库导致数据丢失。",
    );
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
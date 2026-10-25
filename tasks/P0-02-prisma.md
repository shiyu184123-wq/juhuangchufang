# 任务卡：P0-02 Prisma 数据模型第一版

- **阶段**：P0 地基
- **预计耗时**：1.5 小时
- **依赖**：P0-01

## 目标（一句话）

一份能 `migrate` 成功、覆盖登录与处方所需的最小 schema，并有一个可复用的 Prisma 单例。

## 允许修改

- `prisma/schema.prisma`
- `package.json`（仅新增 prisma 相关依赖与 scripts）
- `src/lib/db.ts`
- `.env.example`

## 禁止

- 不写业务接口、不写页面
- 不建 `works` / `tags` / `user_ratings`（那是 P2 的事）
- 不自定义 Auth.js 的表结构（见下方说明）

## 步骤

1. 装依赖：

   ```powershell
   pnpm add -D prisma
   pnpm add @prisma/client
   ```

2. 初始化，**选 sqlite**：

   ```powershell
   pnpm prisma init --datasource-provider sqlite
   ```

3. 写 schema。**认证四表必须用 Auth.js 官方 Prisma schema**（User / Account / Session / VerificationToken），
   不要自己发明字段，否则 adapter 会报错。官方 schema 见 https://authjs.dev/getting-started/adapters/prisma

4. 在官方四表之后追加业务表：

   ```prisma
   // 邮箱验证码（Auth.js 的 Email provider 是魔法链接，验证码要自己存）
   model EmailCode {
     id        String   @id @default(cuid())
     email     String
     codeHash  String
     expiresAt DateTime
     attempts  Int      @default(0)
     createdAt DateTime @default(now())
     @@index([email])
   }

   // 处方记录（游客也有，用 anonId）
   model Prescription {
     id        String   @id @default(cuid())
     userId    String?
     anonId    String?
     workKey   String   // 种子处方键，如 "sober-heal"
     source    String   @default("system") // system | user
     followAt  DateTime?                   // 复诊时间
     status    String   @default("issued") // issued | liked | disliked | unseen
     createdAt DateTime @default(now())
     @@index([followAt])
     @@index([anonId])
   }
   ```

   > 注意：`Prescription` 与 `User` 先不建外键关系（游客 userId 为空），P1 需要时再加。

5. 生成 client 并建表：

   ```powershell
   pnpm prisma migrate dev --name init
   ```

6. 写 `src/lib/db.ts` 单例（防止热更新时创建多个连接）：

   ```ts
   import { PrismaClient } from '@prisma/client'

   const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

   export const prisma = globalForPrisma.prisma ?? new PrismaClient()

   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   ```

## 验收

**命令**

```powershell
pnpm prisma migrate status
pnpm build
pnpm lint
```

**数据**

- [ ] `prisma/dev.db` 文件存在
- [ ] `pnpm prisma studio` 能看到 5 张表：User / Account / Session / VerificationToken / EmailCode / Prescription
- [ ] `DATABASE_URL` 只出现在 `.env.local`（不在 `.env.example` 里写真实值）

## 完成定义

- 上述全部通过
- `PROGRESS.md` 更新为 2/6
- git commit

## 给 AI 的备注

- **不要自己设计 Session 表**。Auth.js 的字段名（`sessionToken`、`expires`）是固定的，改一个字母就会运行时报错。
- SQLite 连接串是 `file:./dev.db`，相对路径基于 `prisma/` 目录，容易搞错，以 `migrate dev` 的报错为准调。
- 不要在本轮加 `onDelete: Cascade` 到你新加的业务表，留着以后按需要加。
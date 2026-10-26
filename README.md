# 剧荒处方

用户剧荒时，给他一部番 + 为什么是它 + 3 天后复诊。

技术栈：Next.js 15 App Router + TypeScript + Tailwind v4 + Prisma 7 + Neon Postgres（托管）+ Auth.js v5。

## 本地开发

1. 复制环境变量模板：`Copy-Item .env.example .env.local`，按注释填写。
   - `DATABASE_URL` 用 Neon 控制台里的连接串（带 `?sslmode=require`）。
   - `BANGUMI_*` 在 Bangumi 应用后台登记，回调地址与 `.env.local` 的 `BANGUMI_REDIRECT_URI` 完全一致。
2. 安装依赖：`pnpm install`
3. 应用迁移：`pnpm db:migrate`（或 `pnpm db:migrate:deploy` 对已有库补迁移）
4. 启动：`pnpm dev`；需要绑定 Bangumi 时用 `pnpm dev:proxy`（Node 24 走系统代理，原因见 DECISIONS D-016）。

> 数据库自 P0-06 起统一为 Neon 托管 Postgres，本仓库不再使用 `prisma/dev.db`。

## 部署（Vercel + Neon）

1. 把仓库推到 GitHub（私有仓库即可），在 Vercel 导入。
2. Neon 建库，复制连接串；Vercel 项目里配环境变量：
   `DATABASE_URL`、`AUTH_SECRET`（线上重新生成）、`BANGUMI_CLIENT_ID`、`BANGUMI_CLIENT_SECRET`、
   `BANGUMI_REDIRECT_URI`（`https://<vercel 域名>/api/auth/callback/bangumi`）、`RESEND_API_KEY`、`OTP_FROM`。
3. 构建命令已内置 `prisma generate`（见 `package.json` 的 `build`），Vercel 零配置即可。
4. 首次部署后，在本地连生产库跑一次 `pnpm db:migrate:deploy`（或把该命令加到 Vercel Build Command）。
5. Bangumi 应用后台把回调地址改成线上地址；本地开发切回时再改回 localhost。
6. `RESEND_API_KEY` 用测试模式（`onboarding@resend.dev`）时，只有注册 Resend 的邮箱能收到验证码；
   要让任意用户登录，需在 Resend 验证自有域名并改 `OTP_FROM`。

## 常用命令

```bash
pnpm dev             # 本地开发（Turbopack）
pnpm dev:proxy       # 本地开发 + 系统代理（Bangumi 绑定必需）
pnpm build           # prisma generate + next build
pnpm lint
pnpm db:generate     # prisma generate
pnpm db:migrate      # prisma migrate dev（开发）
pnpm db:migrate:deploy  # prisma migrate deploy（生产/已有库）
pnpm db:status       # prisma migrate status
pnpm db:studio       # prisma studio
```

## 注意

- 不要把 `.env.local`、任何密钥提交进仓库（已在 `.gitignore`）。
- 线上数据库是新建的 Neon 库，本地 SQLite 的测试数据不会迁移过去。
- 本项目的部署选型、邮件通道与数据库方案见 `DECISIONS.md`，进度见 `PROGRESS.md`。
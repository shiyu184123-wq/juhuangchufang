# 进度看板

> 每轮开发结束后更新。新对话开工前先读这里，不要读整个代码库。

## 总览

| 阶段 | 状态 | 完成度 | 备注 |
|---|---|---|---|
| P0 地基 | 🟡 进行中 | 2/6 | 骨架 + 数据模型已跑通（命名已统一），账号体系未开始 |
| P1 闭环 | ⬜ 未开始 | 0/6 | 诊断 → 处方 → 复诊 |
| P2 精准 | ⬜ 未开始 | 0/6 | 画像 + 推荐 |
| P3 增长 | ⬜ 未开始 | 0/2 | 人开方 + 事件推送 |
| P4 留存 | ⬜ 未开始 | 0/3 | 洞察 + 猜番 + 履历 |

图例：⬜ 未开始 · 🟡 进行中 · ✅ 完成 · ⛔ 阻塞

## 当前状态

- **正在做**：P0-03 邮箱 OTP 登录
- **刚完成**：P0-02 收尾卡（数据库命名统一 snake_case + Prisma 单例加固）
- **下一个**：P0-04 Bangumi OAuth
- **阻塞项**：无

## 已完成

- **P0-01 项目初始化**（Next.js 15.5.28 + TypeScript + Tailwind v4 + App Router + `src/`）
  - 验收：`pnpm install` / `pnpm build` / `pnpm lint` 均 exit 0
  - 手测：`http://localhost:3000` 与 `http://10.5.170.30:3000` 均返回 200，页面含站名「剧荒处方」
  - dev 实际端口：3000

- **P0-02 Prisma 数据模型第一版**（Prisma 7.10.1 + SQLite + better-sqlite3 adapter）
  - 新建 `prisma/schema.prisma`：Auth.js 官方四表（User / Account / Session / VerificationToken，
    字段名与 `@map` 照官方，仅去掉 SQLite 不支持的 `@db.Text`）+ `EmailCode` + `Prescription`
  - 新建 `src/lib/db.ts`：Prisma 单例（Prisma 7 必须注入 `PrismaBetterSqlite3` adapter）
  - 迁移 `20261025091017_init` 已生成并应用；`prisma/dev.db` 已建
  - 验收：`pnpm prisma migrate status` → `Database schema is up to date!`；
    `pnpm build` exit 0；`pnpm lint` exit 0（仅 `next lint` 弃用警告，见 T-002）
  - 数据核验：`sqlite_master` 中 6 张业务表齐全：users / accounts / sessions /
    verification_tokens / EmailCode / Prescription（另有 `_prisma_migrations` 内部表）
    —— 后两张的表名/列名当时是 PascalCase/camelCase 混用，已在下方收尾卡统一为 snake_case

- **P0-02 收尾：数据库命名统一 snake_case + Prisma 单例加固**（不动业务逻辑，未触碰 P0-03）
  - `prisma/schema.prisma`：`EmailCode` 加 `@@map("email_codes")`（`code_hash` / `expires_at` / `created_at`）；
    `Prescription` 加 `@@map("prescriptions")`（`user_id` / `anon_id` / `work_key` / `follow_at` / `created_at`）；
    `source` / `status` 与 Auth.js 四表原有的 `@map` 保持原样。模型字段名仍是 camelCase，只改物理表名/列名
  - 修正 schema 注释：说明官方 schema 是 camelCase 字段名 + `@@map` / `@map` 映射为 snake_case，本项目沿用同一套约定；
    adapter 通过 Prisma Client API（camelCase 属性）访问，不依赖物理表名 —— 已核对官方文档与 `@auth/prisma-adapter` 源码（全部走 client 方法，无 `$queryRaw`）
  - 迁移重置（刻意，见 DECISIONS D-012）：删掉 `20261025091017_init` 与 `prisma/dev.db`，
    重新 `migrate dev --name init` 生成 `20261025092643_init`；表为空且未上线，直接丢弃历史迁移成本最低
  - `src/lib/db.ts`：去掉 `?? "file:./prisma/dev.db"` 兜底，缺 `DATABASE_URL` 时直接抛错并指明配置文件是 `.env.local`
  - 验收：`pnpm prisma migrate status` → `Database schema is up to date!`（1 migration found）；
    better-sqlite3 实测 `sqlite_master` 六张业务表 = accounts / email_codes / prescriptions / sessions /
    users / verification_tokens，`email_codes` 列为 code_hash/expires_at/created_at、
    `prescriptions` 列为 user_id/anon_id/work_key/follow_at/created_at 均符合预期；
    `pnpm build` exit 0；`pnpm lint` exit 0（仅 `next lint` 弃用警告，见 T-002）

## 已知问题 / 技术债

| 编号 | 问题 | 影响 | 计划 |
|---|---|---|---|
| T-001 | 本机沙箱下 `pnpm install / build / lint / dev` 会被拦（pnpm store 在工作区外；Next 构建要派生子进程，受限模式报 `spawn EPERM`），需以完全权限运行 | 每轮验收都得在完全权限下跑 | 长期：把 pnpm store 收进工作区或调整沙箱策略 |
| T-002 | `next lint` 在 Next 16 会被移除 | 升级 Next 前必须迁移到 ESLint CLI | 升 Next 16 前处理 |
| T-003 | pnpm 12 已不再读 `onlyBuiltDependencies`，改用 `allowBuilds`（`pnpm approve-builds` 写入）；P0-01 配置的 `unrs-resolver` 条目在本次 approve-builds 重写时被移除 | 若某依赖将来需要构建脚本，会出现 `ERR_PNPM_IGNORED_BUILDS` | 下轮若再撞到，把对应包名补进 `allowBuilds` |
| T-004 | `prisma init` 会额外生成 `.agents/skills/`、`.claude/skills/`、`.windsurf/skills/` 与 `skills-lock.json`（Prisma 官方 AI 指南，约 300KB） | 仓库多出非任务要求的生成物 | 已随本轮提交；若嫌冗余，后续可删并靠 `prisma skills sync` 重建 |
| T-005 | Prisma 7 SQL 路径强制要求 driver adapter；任务卡 P0-02 给的 `new PrismaClient()` 旧写法不适用 | 后续建 client 一律走 `src/lib/db.ts` 的 `prisma` 导出 | 已在 `DECISIONS.md` 记录 |
| T-006 | 本轮刻意删改已提交的迁移（`20261025091017_init` → `20261025092643_init`，见 D-012） | 其他机器/分支上残留的旧 `prisma/dev.db` 会与迁移记录不匹配 | 换机器时删掉 `prisma/dev.db` 后跑 `pnpm db:migrate` 重建；从此迁移文件只追加不改写 |

## 关键指标（自己填，用来判断是否该继续投）

| 指标 | 目标 | 当前 |
|---|---|---|
| 游客走完诊断的比例 | ≥ 60% | — |
| 收到复诊并回复的比例 | ≥ 30% | — |
| 推荐"愿意看"命中率 | ≥ 6/10 | — |
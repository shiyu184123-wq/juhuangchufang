# 决策记录（ADR）

> 只记录"会长期影响后续开发"的决定。新对话遇到分歧先读这里，不要推翻已有决策。
> 格式：编号 · 日期 · 决策 · 为什么 · 替代方案

---

## D-001 · 2025 · 形态选 Web 优先，不做原生 App

- **决策**：先做移动优先的响应式 Web（可 PWA 化），后续再考虑套壳。
- **为什么**：核心场景是"躺床上剧荒时随手打开"和"分享给朋友"，链接传播的转化率远高于下载安装；个人开发资源有限，双端原生成本过高。
- **替代**：原生 App（推送强但拉新弱）、微信小程序（分享最自然但需资质备案）。
- **影响**：所有状态必须服务端存储；推送首选用邮件。

## D-002 · 2025 · 技术栈 Next.js 15 App Router

- **决策**：Next.js + TypeScript + Tailwind + Prisma + SQLite(dev)。
- **为什么**：处方卡和猜番结果需要 OG 预览图，必须服务端渲染；前后端同仓库降低个人维护成本。
- **替代**：Vite + 独立后端（OG 需额外处理）、Remix。
- **影响**：禁止 Pages Router、禁止换成 Vite。

## D-003 · 2025 · 认证用 Auth.js v5 + 自定义 Bangumi provider

- **决策**：Auth.js 承载会话，Bangumi OAuth 需要**自定义 provider**（无内置）。
- **为什么**：用 Bangumi 登录可一次性完成"注册 + 画像数据获取"。
- **注意**：Auth.js 的 Email provider 是魔法链接，不是验证码；邮箱 OTP 需自行实现。
- **替代**：Better Auth（对 OTP 支持更好，可评估后替换）。

## D-004 · 2025 · 推荐算法走"内容向量 + 好友口碑"，不上模型训练

- **决策**：口味向量 = Σ(用户评分 − 全站均分) × 标签向量；打分 = 0.6·内容相似 + 0.3·好友口碑 + 0.1·新鲜度。
- **为什么**：数据量不足以训练模型；Bangumi 标签粒度细，内容向量已经够用；可解释性强，便于生成个性化理由。
- **替代**：协同过滤（需大量用户数据）、embedding 语义匹配（P2 后再评估）。

## D-005 · 2025 · 游客与复诊的关系

- **决策**：游客可完整体验诊断与出处方，但复诊需要提供邮箱（半注册）。
- **为什么**：复诊是产品灵魂，无触达渠道的游客无法完成闭环。
- **影响**：M0 的游客身份定义需要在实现时明确为"匿名会话 + 可选邮箱"。

## D-006 · 2026 · Tailwind 用 v4（无 tailwind.config.ts）

- **决策**：跟随 create-next-app 15.5 默认模板，使用 Tailwind v4：`@import "tailwindcss"` + `postcss.config.mjs` 里 `@tailwindcss/postcss`，**不再生成 `tailwind.config.ts`**。
- **为什么**：v4 是当前模板默认，少一个配置文件；设计令牌走 CSS `@theme`。
- **替代**：锁定 v3（生态资料多，但要手动降级并维护 3 份配置文件）。
- **影响**：任务卡里提到的 `tailwind.config.ts` 不会出现；主题定制写进 `src/app/globals.css` 的 `@theme`。

## D-007 · 2026 · Lint 用 ESLint 9 + eslint-config-next 15.5（next lint）

- **决策**：`eslint@9` + `eslint-config-next@15.5.28`（与 next 版本对齐）+ `prettier`；配置沿用 `.eslintrc.json`，命令用 `next lint`。`eslint-config-next` 不提供 flat config 导出，改用 `eslint .` 需要额外引入 `@eslint/eslintrc`，本轮不为此加依赖。
- **为什么**：`pnpm add -D eslint eslint-config-next` 默认会拉到 eslint 10 + config 16（配 Next 16），必须显式钉版本；保持依赖与 Next 大版本一致。
- **替代**：flat config（`eslint.config.mjs`）+ FlatCompat（需加依赖）；Biome（换掉 ESLint）。
- **影响**：升级 Next 16 时必须同步迁移到 ESLint CLI（`next lint` 将在 16 移除）。`pnpm` 相关配置写进 `pnpm-workspace.yaml`（pnpm 12 不再读 package.json 的 `pnpm` 字段）。

## D-008 · 2026 · Prisma 7 + better-sqlite3 driver adapter

- **决策**：Prisma 钉 `7.10.1`（显式版本，不用 `latest`——registry 的 latest 已指向 `8.0.0-rc`）；SQLite 走 `@prisma/adapter-better-sqlite3` + `better-sqlite3`，`src/lib/db.ts` 里 `new PrismaClient({ adapter })`。
- **为什么**：Prisma 7 的 SQL 路径移除了内置 query engine，driver adapter 是唯一官方路径；Prisma 6 已 EOL，不宜新项目起用。
- **替代**：Prisma 6.19 经典写法（任务卡原示例），但属倒退。
- **影响**：任务卡 P0-02 的 `new PrismaClient()` 单例不可用；全项目统一从 `@/lib/db` 导入 `prisma`。

## D-009 · 2026 · DATABASE_URL 只放 `.env.local`

- **决策**：真实连接串只写 `.env.local`（gitignore）；`prisma7.config.ts` 用 `dotenv` 显式加载 `.env.local`；`.env.example` 只留占位。
- **为什么**：Prisma 7 不再自动加载 .env；CLI 与 Next 运行时读同一份配置，避免出现两个 dev.db。
- **影响**：`prisma init` 生成的根 `.env` 已删除。

## D-010 · 2026 · SQLite 相对路径以项目根为基准

- **决策**：`DATABASE_URL="file:./prisma/dev.db"`（任务卡原写 `file:./dev.db`）。
- **为什么**：Prisma 7 相对路径基准是 `prisma7.config.ts` 所在目录（项目根），不再是 Prisma 6 的 `prisma/` 目录；实测可正确落在 `prisma/dev.db`。
- **影响**：`prisma/dev.db` 已进 `.gitignore`，靠 `pnpm db:migrate` 重建。

## D-011 · 2026 · pnpm 12 用 `allowBuilds` 批准构建脚本

- **决策**：`pnpm-workspace.yaml` 用 `allowBuilds`（`prisma` / `@prisma/engines` / `better-sqlite3`）。
- **为什么**：pnpm 11+ 弃用 `onlyBuiltDependencies`，只认 `allowBuilds`；Prisma engines 与 better-sqlite3 原生模块依赖 postinstall。
- **影响**：P0-01 的 `unrs-resolver` 条目在 approve-builds 重写时被移除（PROGRESS T-003）。

---

## 待决

| 编号 | 待决问题 | 影响 |
|---|---|---|
| Q-001 | 时长维度保留几档 | 诊断步骤数 |
| Q-002 | 首发推送渠道：邮件 / Bark | P3 工期 |
| Q-003 | 社交层（好友评分）是否首发 | 推荐精度 vs 上线速度 |
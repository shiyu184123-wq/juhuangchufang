# 进度看板

> 每轮开发结束后更新。新对话开工前先读这里，不要读整个代码库。

## 总览

| 阶段 | 状态 | 完成度 | 备注 |
|---|---|---|---|
| P0 地基 | 🟡 进行中 | 4/6 | 骨架 + 数据模型 + 验证码登录 + Bangumi 绑定已跑通，剩应用外壳与部署 |
| P1 闭环 | ⬜ 未开始 | 0/6 | 诊断 → 处方 → 复诊 |
| P2 精准 | ⬜ 未开始 | 0/6 | 画像 + 推荐 |
| P3 增长 | ⬜ 未开始 | 0/2 | 人开方 + 事件推送 |
| P4 留存 | ⬜ 未开始 | 0/3 | 洞察 + 猜番 + 履历 |

图例：⬜ 未开始 · 🟡 进行中 · ✅ 完成 · ⛔ 阻塞

## 当前状态

- **正在做**：无 —— P0-04（含收尾：真实绑定跑通）已完成并提交，等下一张任务卡
- **刚完成**：P0-04 收尾 —— `pnpm dev:proxy` 解决 Node 代理问题，真实 Bangumi 绑定验证通过（`MegumiKT` / 317 条）
- **下一个**：P0-05 应用外壳（`tasks/P0-05-shell.md`）
- **阻塞项**：无。只剩 T-010（token 7 天过期需重新授权，未做自动刷新）。
  本地起 dev 请用 `pnpm dev:proxy`（否则 Node 直连 bgm.tv 必失败，见 D-016）；`.env.local` 三项凭据已配好

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

- **P0-03 邮箱验证码登录**（next-auth 5.0.0-beta.32 + resend 6.34.1 + zod 4.6.7）
  - `src/lib/auth.ts`：Credentials provider + `session.strategy = "jwt"`；校验与建用户都在 `authorize` 里完成，
    verify 接口用 `signIn("credentials")` 复用同一条路径，保证验证码只被消费一次；失败一律 `null`（不区分码错/过期）
  - `src/lib/otp.ts`：6 位码存 `<salt>:<sha256>`（每条独立 salt，防 100 万种号码反查）；`timingSafeEqual` 比对；
    10 分钟过期、连错 5 次即作废；发码限流（同邮箱 60 秒、同 IP 每小时 10 次，内存版）
  - 三个路由：`/api/auth/otp/send`、`/api/auth/otp/verify`、`/api/auth/[...nextauth]`；
    页面：`/login`（两步式，`inputMode="numeric"`、按钮 ≥ 44px）、`/me`（显示邮箱 + 退出）
  - `next.config.ts`：`serverExternalPackages` 放行 better-sqlite3 —— Turbopack 打包原生模块会重写 `__dirname`，
    运行时找不到 `better_sqlite3.node`（详见 T-007）
  - 选型：**A（Credentials + JWT）**，不装 `@auth/prisma-adapter`（与 Prisma 7.10.1 不兼容，实测 peer 只到 `@prisma/client >=6`，
    且 Prisma 7 的 `@prisma/client` 已不导出该类型）—— 完整理由见 DECISIONS D-014
  - 验收：`scripts/check.ps1`（本机只有 Windows PowerShell，用 `powershell -File` 跑）→ `pnpm build` exit 0、
    `pnpm lint` 无告警（exit 0）
  - 接口手测（curl 打真实 dev server）：发码 200 且响应不含码 → 正确码 verify 200 拿到会话 cookie → `/me` 200 显示邮箱 →
    错码连试 5 次全部 400 且统一提示，第 6 次用真码已失效 → 同邮箱 60 秒内重发 429 → signout 302 后 `/me` 307 回 `/login`
  - 数据核验：`email_codes.code_hash` = 32 位 hex salt + `:` + 64 位 hex，无明文；`users.email_verified` 已写入
  - 未做：真实邮件投递、手机真机完整登录（本地无 `RESEND_API_KEY`，见 T-008）

- **P0-04 Bangumi 账号绑定**（手写 OAuth 授权码流程，不装 adapter、不注册 Auth.js provider，见 D-015）
  - `src/lib/bgm/api.ts`：端点/常量 + 核实结论注释（2026-10-25 与官方 `How-to-Auth.md`、`open-api/v0.yaml` 逐条比对）；
    三类请求（授权页拼 URL / 换 token / 调 API）统一带 `User-Agent: shiyu/juhuang-chufang`、10 秒超时、
    返回结构化 `{ ok, data } | { ok, error }` 而不是抛裸异常；**刻意不传 `scope`**（官方标注尚未实现）
  - `src/lib/bgm/binding.ts`：`bindBangumiAccount`（`upsert` + 换绑先删旧行 + 拒绝抢别人已绑的号）、
    `unbindBangumiAccount`（只删当前用户那条）、`getBangumiCard`（先查库，5 分钟缓存键 = `account.id + expires_at`，
    解绑/换绑自动失效；`/v0/me` 401 → 「授权已失效」，`expires_at` 已过 → 「授权已过期」）
  - 三个路由：`/api/auth/bangumi/start`（要求已登录 → 随机 `state` 存 httpOnly cookie → 302 授权页）、
    `/api/auth/callback/bangumi`（`state` 校验 → 换 token → `/v0/me` → 落库；每一步失败都 redirect 带中文提示）、
    `/api/auth/bangumi/unbind`（表单 POST → 303，不依赖 JS）
  - `src/app/settings/page.tsx`：未绑定 → 「绑定 Bangumi」；已绑定 → 昵称 / `@username` / 收藏总数 + 「解绑」；
    12 种结果提示（成功 / 取消 / 过期 / state 失败 / 缺配置 / 读取失败 / 被占用 / 解绑…）；按钮 ≥ 44px
  - `.env.example` 补凭据注释；**`src/lib/auth.ts` 与 `prisma/schema.prisma` 未改动**
  - 验收：`scripts/check.ps1` → `pnpm build` exit 0（`/settings`、`/api/auth/callback/bangumi` 均编译进路由表）、
    `pnpm lint` 无告警（exit 0）
  - 手测（curl 打 dev server；Bangumi 侧用本地 mock 服务替身，原因见 T-011）：
    - 未登录 `start` → 307 `/login`；未登录回调 → `/settings?bgm=login`；回调由本路由处理
      （响应里带清 state cookie），证明静态段路由优先于 `[...nextauth]` catch-all
    - 授权 URL 参数正确：`client_id`、`response_type=code`、`redirect_uri`、`state`，**无 `scope`**；
      `Set-Cookie: bgm_oauth_state=…; Path=/; Max-Age=600; HttpOnly; SameSite=lax`
    - 正确 state + code → `/settings?bgm=ok`；DB 行 `provider_account_id=12345`、`expires_at` = now + 604800 秒、
      `refresh_token` 已存、`token_type=Bearer`；页面显示 `Sai🖖` / `@sai` / `收藏总数 42 条`
    - 伪造 state → `/settings?bgm=state`；缺 state cookie → 同上；`error=access_denied` → `/settings?bgm=denied`
    - 换 token 失败（含授权码 60 秒过期、网络不通）→ `/settings?bgm=invalid_code`，
      页面显示「授权已过期（授权码只有 60 秒有效期），请重新点一次绑定」，不白屏
    - 解绑 → 303 `/settings?bgm=unbound`，DB 行删除、页面回未绑定态；解绑后可再次绑定成功
    - 同一 Bangumi 号被第二个本站账号绑定 → `/settings?bgm=taken`，原绑定未被抢走；
      另一个本站账号看不到别人的绑定信息
    - token 被改坏 → 「Bangumi 授权已失效，请重新绑定。」；`expires_at` 改成过去 → 「Bangumi 授权已过期（有效期 7 天）…」
    - 页面源码不含 `access_token` / `refresh_token` 的字段名与值；mock 日志确认换 token、`/v0/me`、
      `/v0/users/sai/collections?limit=1&offset=0` 三次请求都带正确 User-Agent
    - 连续两次刷新设置页只打一组 Bangumi 请求（5 分钟缓存生效）
  - 顺带修掉一个真 bug：缓存原先按 `userId` 命中、靠手动清；dev 下 route handler 与 page 属于不同模块实例，
    清缓存清不到另一份 `Map`，表现为「解绑后页面仍显示已绑定」。改为先查库 + 缓存键含 `account.id`/`expires_at`
  - 未做：token 自动刷新（T-010）

- **P0-04 收尾：真实 Bangumi 绑定跑通**（2026-10-25，经系统代理与真实服务器对接）
  - 新增 `scripts/dev.ps1` + `pnpm dev:proxy`：启动前读 Windows 系统代理，设置 `HTTPS_PROXY` / `HTTP_PROXY` +
    `NODE_USE_ENV_PROXY=1`。原因：Node 24 的 `fetch` 不读系统代理，只设 `HTTPS_PROXY` 无效（实测证据见 D-016）
  - 缺陷修复：① 网络错误不再误报「授权码过期」—— 回调按 `error.kind === "network"` 分流到
    `/settings?bgm=network`，新增文案「连不上 Bangumi 服务器（可能是网络或代理问题），请稍后重试。」；
    ② `/me` 增加「设置」入口（触控区 ≥ 44px），不再需要手输 URL
  - **真实绑定结果**（本站账号 `p004-real@example.com` 绑定 Bangumi 用户 `MegumiKT`）：
    - 授权跳转：`GET https://bgm.tv/oauth/authorize?client_id=bgm73976addfd2be52aa&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fbangumi&state=…`；
      未登录 Bangumi 时真实服务器 302 到 `/login?chii_referer=/oauth/authorize?client_id=…`，说明 client_id 与 redirect_uri 均被接受
    - 回调：`307 → /settings?bgm=ok`（换 token + `/v0/me` + collections 真实往返 2603ms）
    - DB：`provider_account_id=894485`（Bangumi 数字 id）、`expires_at` = now + 604800 秒、
      `access_token` / `refresh_token` 各 40 字符、`token_type=Bearer`
    - 页面：`MegumiKT` / `@894485` / `收藏总数 317 条`
  - **收藏总数核对方式**：`GET /v0/users/894485/collections?limit=1&offset=0` 的 `total = 317`；
    再按 `subject_type` 分别取：书籍 0 / 动画 317 / 音乐 0 / 游戏 0 / 三次元 0，合计正好 317 ——
    与「全类型合计」口径自洽，也与页面「317 条」一致。主页上分类型显示的数字需你本人对照（见下）
  - 其余断言全过：刷新后信息仍在；解绑 303 → 未绑定态且 DB 行删除；解绑后再绑成功（新 `account.id`，缓存未串）；
    模拟授权页取消 → `?bgm=denied` +「你在 Bangumi 授权页取消了授权」，且原绑定不受影响；
    另一个邮箱账号看不到任何绑定信息；页面源码不含 token 字段名与值
  - 缓存实测：首次渲染 863ms（真打两次 Bangumi API），之后 217ms / 182ms（命中进程内缓存）
  - 仍未验证：① 页面「317 条」与你 bgm.tv 网页版个人主页上的数字是否一致（我拿到的是 API 口径，主页得你肉眼对照）；
    ② token 自动刷新（T-010）

## 已知问题 / 技术债

| 编号 | 问题 | 影响 | 计划 |
|---|---|---|---|
| T-001 | 本机沙箱下 `pnpm install / build / lint / dev` 会被拦（pnpm store 在工作区外；Next 构建要派生子进程，受限模式报 `spawn EPERM`），需以完全权限运行 | 每轮验收都得在完全权限下跑 | 长期：把 pnpm store 收进工作区或调整沙箱策略 |
| T-002 | `next lint` 在 Next 16 会被移除 | 升级 Next 前必须迁移到 ESLint CLI | 升 Next 16 前处理 |
| T-003 | pnpm 12 已不再读 `onlyBuiltDependencies`，改用 `allowBuilds`（`pnpm approve-builds` 写入）；P0-01 配置的 `unrs-resolver` 条目在本次 approve-builds 重写时被移除 | 若某依赖将来需要构建脚本，会出现 `ERR_PNPM_IGNORED_BUILDS` | 下轮若再撞到，把对应包名补进 `allowBuilds` |
| T-004 | `prisma init` 会额外生成 `.agents/skills/`、`.claude/skills/`、`.windsurf/skills/` 与 `skills-lock.json`（Prisma 官方 AI 指南，约 300KB） | 仓库多出非任务要求的生成物 | 已随本轮提交；若嫌冗余，后续可删并靠 `prisma skills sync` 重建 |
| T-005 | Prisma 7 SQL 路径强制要求 driver adapter；任务卡 P0-02 给的 `new PrismaClient()` 旧写法不适用 | 后续建 client 一律走 `src/lib/db.ts` 的 `prisma` 导出 | 已在 `DECISIONS.md` 记录 |
| T-006 | 本轮刻意删改已提交的迁移（`20261025091017_init` → `20261025092643_init`，见 D-012） | 其他机器/分支上残留的旧 `prisma/dev.db` 会与迁移记录不匹配 | 换机器时删掉 `prisma/dev.db` 后跑 `pnpm db:migrate` 重建；从此迁移文件只追加不改写 |
| T-007 | `better-sqlite3` 双版本：项目根是 13.0.3（**未编译出原生 binding**），`@prisma/adapter-better-sqlite3` 内嵌的 12.11.1 才有 `better_sqlite3.node` | 去掉 `next.config.ts` 的 `serverExternalPackages` 后，dev 下任何 DB 调用都报 `Could not locate the bindings file` | 根治：把 `better-sqlite3` 固定到 12.11.1（或 pnpm overrides 统一），再移除 workaround 复测 |
| T-008 | 本地没有 `RESEND_API_KEY`：开发环境改为"跳过真实发信、把验证码打到服务端日志"，生产仍缺 key 即报错 | **登录链路已端到端验证**（2026-10-25 用 ofdgcdb784@do2.online 实测 8 项全过：发码 200 且响应不含码 / 60 秒内重发 429 带 Retry-After / 正确码 200 且 Set-Cookie 含会话 / `/me` 200 显示该邮箱 / 同码复用 400 / 5 次错码后真码作废 400 / signout 302 后 `/me` 307 跳 `/login`；DB 中 `code_hash` 为 32hex:64hex 无明文、`users.email_verified` 已写入）；**真实邮件投递仍未验证**，手机真机未验证 | 要真测投递时把 key 写进 `.env.local`，先用 `onboarding@resend.dev` 发给自己的注册邮箱 |
| T-009 | 发码限流是进程内 `Map` | 多实例部署时每个实例各限各的，等于放宽上限 | P0 单实例够用；上多实例前换 Redis 或数据库计数 |
| T-010 | Bangumi `access_token` 有效期只有 7 天，本轮**不实现自动刷新**（`refresh_token` / `expires_at` 已存库） | 绑定 7 天后设置页会提示「授权已过期，请重新绑定」，用户每 7 天要重新授权一次 | 接 P2-01 收藏同步时一并做 `grant_type=refresh_token`，在该端点同域名下续期并回写 |
| T-011 | Node 的 fetch 不读 Windows 系统代理，Node 24 需 `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY` 才走代理，否则直连 bgm.tv 拿到被污染 DNS 结果并超时 | 本地 dev 必须带代理启动，否则绑定必失败 | **已解决**：`scripts/dev.ps1` 自动读系统代理并设置；生产服务器能直连，不受影响（见 D-016） |

## 关键指标（自己填，用来判断是否该继续投）

| 指标 | 目标 | 当前 |
|---|---|---|
| 游客走完诊断的比例 | ≥ 60% | — |
| 收到复诊并回复的比例 | ≥ 30% | — |
| 推荐"愿意看"命中率 | ≥ 6/10 | — |
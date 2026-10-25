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

- **正在做**：无 —— T-007（`better-sqlite3` 版本错配）已修完，等下一张任务卡
- **刚完成**：T-007 —— `better-sqlite3` 从 `13.0.3` 钉到 `12.11.1`，全仓库只剩一个版本、二进制由包自带
  （`pnpm install` 一条命令可重建）；`serverExternalPackages` 经 Next 官方文档与内置列表核实**是必需配置，已保留**
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
    与「全类型合计」口径自洽，也与页面「317 条」一致；并用公开主页 `bgm.tv/user/894485` 交叉核对：
    在看 15 + 看过 301 + 想看 1 = 317
  - 其余断言全过：刷新后信息仍在；解绑 303 → 未绑定态且 DB 行删除；解绑后再绑成功（新 `account.id`，缓存未串）；
    模拟授权页取消 → `?bgm=denied` +「你在 Bangumi 授权页取消了授权」，且原绑定不受影响；
    另一个邮箱账号看不到任何绑定信息；页面源码不含 token 字段名与值
  - 缓存实测：首次渲染 863ms（真打两次 Bangumi API），之后 217ms / 182ms（命中进程内缓存）
  - 仍未验证：token 自动刷新（T-010）；真实邮件投递与手机真机（T-008）

- **T-007 修复：`better-sqlite3` 版本错配**（只动 `package.json` / `pnpm-workspace.yaml` / `next.config.ts`，不碰业务代码）
  - **诊断推翻了原先的病因假设**：13.0.3 不是"没编译出来"，而是**13.x 起根本不需要编译**——它
    `"gypfile": false`、**没有 `install` 脚本**、二进制随包发布在 `prebuilds/win32-x64.node`（1,989,632 B），
    由 `lib/binding.js` 在运行时按 `process.platform` 直接 `require`。所以
    `build/Release/better_sqlite3.node` 在 13.x 下**本来就不该存在**，拿它当"缺二进制"是误判。
    （12.11.1 才是老路子：`install: prebuild-install || node-gyp rebuild --release` → `build/Release/*.node`）
  - **真正的根因**：`package.json` 直接依赖 `^13.0.3`，而 `@prisma/adapter-better-sqlite3@7.10.1` 把
    `better-sqlite3: ^12.6.0` 声明在 **`dependencies`（不是 `peerDependencies`）** 里 —— pnpm 隔离，
    于是同一仓库装了两份。业务代码从不直接 `import "better-sqlite3"`，全靠 adapter 内部那份 12.11.1 在跑，
    顶层 13.0.3 是**死依赖**；之前能跑，纯属 pnpm 目录布局 + `serverExternalPackages` 凑巧对上。
  - **选方案 A**：`package.json` 写死 `"better-sqlite3": "12.11.1"`（精确版本、不带 `^`），与 adapter 的
    `^12.6.0` 对齐后 pnpm 去重成一份。不用 `pnpm.overrides`：一条精确依赖已经够，overrides 属于"将来若
    第三方再拉 13.x"的备用手段，现在加只是多一层隐式规则。
  - **各问各答**：
    - 「13.0.3 为何没产出二进制」→ 它不需要产出，见上。
    - 「pnpm 12 控制构建脚本白名单的正确字段」→ **`allowBuilds`**（写在 `pnpm-workspace.yaml`）。
      证据取自本机 pnpm 12.15.0 自带 CHANGELOG：`onlyBuiltDependencies` / `onlyBuiltDependenciesFile` /
      `neverBuiltDependencies` / `ignoredBuiltDependencies` 在 **pnpm 11** 就被 `allowBuilds` 取代、
      此后**静默忽略**；`pnpm config get allowBuilds` 能读到值、`pnpm config get onlyBuiltDependencies` 返回
      `undefined`。项目原本已是对的（D-011），没有需要修的字段名。
    - 「`serverExternalPackages` 能不能删」→ **不能，已保留**。依据 Next.js 15 官方文档
      （`next.config.js` → `serverExternalPackages`：用 Node 专有能力的依赖可改为原生 `require`）与本机
      `next@15.5.28` 的 `dist/lib/server-external-packages.json`：`better-sqlite3`、`@prisma/client` 在
      内置列表里，**`@prisma/adapter-better-sqlite3` 不在** —— 它才是这条配置真正不可删的理由。
      技术债原文里"移除 workaround 复测"这句是误导向，按官方文档纠正（见 D-018）。
  - 顺带修掉全量重装暴露的白名单缺口：`unrs-resolver`（eslint 解析器链）的 postinstall 被拦，导致
    `pnpm install` 以 `ERR_PNPM_IGNORED_BUILDS` 退出。它的原生 `.node` 由 `optionalDependencies`
    （`@unrs/resolver-binding-win32-x64-msvc`，1,886,720 B）直接分发，postinstall 只是兜底校验，
    故在 `allowBuilds` 里显式写 `unrs-resolver: false`（`false` 也是"已决策"，不再报错，且不放第三方脚本进流水线）。
  - **验证（不靠巧合）**：
    - 版本：`pnpm why better-sqlite3` → `Found 1 version of better-sqlite3`；
      `node_modules/.pnpm/` 下只剩 `better-sqlite3@12.11.1`；13.0.3 与旧 peer-hash 的 prisma 虚拟目录已随
      删除 `node_modules` 后重装清掉（实话：`Remove-Item` 在 `better_sqlite3.node` 上被占用拦了一下、
      未删净，随后 `pnpm install` 重建了完整布局，最终只有 12.11.1 这一份）
    - 二进制：`node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
      = 1,919,488 B（> 1 MB）
    - 加载实测：`node -e "require('better-sqlite3')"` → `sqlite_version = 3.53.2`，建表/插入/读回 42 全过
    - 单实例：`require.resolve` 从根与从 adapter 两个方向解析到**同一个文件**（`.pnpm/better-sqlite3@12.11.1/...`）
    - 回归（`pnpm dev:proxy`，真实 dev server）：
      - 邮箱验证码登录（写库）：发码 200 → 日志取码 → verify 200 → DB `users` 新增
        `t007-verify@example.com` 且 `email_verified` 已写；同码复用 400；60 秒内重发 429
      - `/settings` 读库 + 真实 Bangumi API：登录 `p004-real@example.com` → 页面渲染
        `MegumiKT` / `@894485` / `收藏总数 317 条`
      - 解绑：`POST /api/auth/bangumi/unbind` → 303 `/settings?bgm=unbound`，页面回到未绑定态、
        DB `accounts` 中 bangumi 行数 1 → 0（`deleteMany` 生效，缓存未串）
      - 绑定数据已用备份还原（事务内"先删同用户旧行、再写入"，即 `bindBangumiAccount` 的 SQL 语义），
        还原后 `/settings` 再次读到 `MegumiKT` / 317 条
    - `pnpm build` exit 0（9 条路由照常产出）、`pnpm lint` exit 0（仅 `next lint` 弃用告警，见 T-002）
  - **仍未覆盖（需人工）**：`bindBangumiAccount` 里 `prisma.$transaction([deleteMany, upsert])` 这一条
    真实路径，要有一次**真实 Bangumi 授权回调**才能跑到 —— OAuth 授权码必须由人在浏览器点「同意授权」，
    无法脚本化。按 D-015 的既有实测（P0-04 收尾）该校验已通过一次，本次只换了 better-sqlite3 版本，
    adapter 与 Prisma 版本未变；重绑请在浏览器走一遍 `设置 → 绑定 Bangumi → 同意`，预期落回
    `/settings?bgm=ok` 并显示 `MegumiKT` / 317 条。

## 已知问题 / 技术债

| 编号 | 问题 | 影响 | 计划 |
|---|---|---|---|
| T-001 | 本机沙箱下 `pnpm install / build / lint / dev` 会被拦（pnpm store 在工作区外；Next 构建要派生子进程，受限模式报 `spawn EPERM`），需以完全权限运行 | 每轮验收都得在完全权限下跑 | 长期：把 pnpm store 收进工作区或调整沙箱策略 |
| T-002 | `next lint` 在 Next 16 会被移除 | 升级 Next 前必须迁移到 ESLint CLI | 升 Next 16 前处理 |
| T-003 | pnpm 12 已不再读 `onlyBuiltDependencies`，改用 `allowBuilds`（`pnpm approve-builds` 写入；pnpm 11 起旧字段被静默忽略）；P0-01 配置的 `unrs-resolver` 条目曾被 approve-builds 重写时移除 | 未列入白名单的构建脚本会让 `pnpm install` 以 `ERR_PNPM_IGNORED_BUILDS` 退出 | **已按此机制处理两次**：T-007 全量重装时 `unrs-resolver` 报错，已写 `unrs-resolver: false`（它的 `.node` 走 `optionalDependencies`，不需要跑脚本）；以后再撞到，同样用 `allowBuilds` 补 `true`/`false` |
| T-004 | `prisma init` 会额外生成 `.agents/skills/`、`.claude/skills/`、`.windsurf/skills/` 与 `skills-lock.json`（Prisma 官方 AI 指南，约 300KB） | 仓库多出非任务要求的生成物 | 已随本轮提交；若嫌冗余，后续可删并靠 `prisma skills sync` 重建 |
| T-005 | Prisma 7 SQL 路径强制要求 driver adapter；任务卡 P0-02 给的 `new PrismaClient()` 旧写法不适用 | 后续建 client 一律走 `src/lib/db.ts` 的 `prisma` 导出 | 已在 `DECISIONS.md` 记录 |
| T-006 | 本轮刻意删改已提交的迁移（`20261025091017_init` → `20261025092643_init`，见 D-012） | 其他机器/分支上残留的旧 `prisma/dev.db` 会与迁移记录不匹配 | 换机器时删掉 `prisma/dev.db` 后跑 `pnpm db:migrate` 重建；从此迁移文件只追加不改写 |
| T-007 | `better-sqlite3` 双版本（根 `^13.0.3` vs adapter `dependencies` 里的 `^12.6.0`）：13.0.3 走的 `prebuilds/` 布局**本来就不产出 `build/Release/*.node`**，之前"没编译出二进制"是误判 | 顶层 13.0.3 实际是死依赖，全仓库靠 adapter 内嵌的 12.11.1 在跑；靠 pnpm 布局巧合成立 | **已解决**（2026-10-25）：`package.json` 写死 `"better-sqlite3": "12.11.1"`，`pnpm why` → `Found 1 version`，二进制 1,919,488 B、实测可 `require`；`serverExternalPackages` 经官方文档核实为**必需配置**，保留（D-017 / D-018） |
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
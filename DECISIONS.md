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
- **影响**：P0-01 的 `unrs-resolver` 条目在 approve-builds 重写时被移除（PROGRESS T-003）；T-007 全量重装时它再次触发 `ERR_PNPM_IGNORED_BUILDS`，现以 `unrs-resolver: false` 显式拒绝（`false` 也算"已决策"，其 `.node` 由 `optionalDependencies` 直接分发，不需要跑 postinstall）。

## D-012 · 2026 · 数据库物理命名统一 snake_case（含迁移重置）

- **决策**：所有表名与列名统一 snake_case：Auth.js 四表沿用其 `@map`（`users` / `accounts` / `sessions` /
  `verification_tokens`）；`EmailCode` → 表 `email_codes`（`code_hash` / `expires_at` / `created_at`）；
  `Prescription` → 表 `prescriptions`（`user_id` / `anon_id` / `work_key` / `follow_at` / `created_at`）。
  Prisma 模型字段名保持 camelCase，只通过 `@@map` / `@map` 决定物理名。
- **为什么**：命名混用（Auth.js 四表 snake_case vs 业务表 PascalCase/camelCase）在 P0-06 迁 Postgres 时会
  变成一堆带引号的大小写标识符，越晚统一成本越高；此刻表为空、未上线，重建迁移是零成本窗口。
- **刻意重置**：删除并重建 `20261025091017_init` → `20261025092643_init`，**已提交的迁移文件被改写**。
  这是一次性问题：从这里开始迁移文件只追加、不再改写（上线后必须走 forward migration）。
- **替代**：保留旧迁移再加一个 rename 迁移（要在 SQLite 上重建表，且现场无人依赖旧库）；保持混用（迁移期踩坑）。
- **影响**：以后新增模型一律 snake_case 物理命名；**任何已上线的迁移不得再删改**。Auth.js adapter 不受影响
  ——它走 Prisma Client API，不读物理表名。

## D-013 · 2026 · Prisma 单例不静默降级（缺 DATABASE_URL 直接抛错）

- **决策**：`src/lib/db.ts` 不再 `process.env.DATABASE_URL ?? "file:./prisma/dev.db"`；读不到变量时抛出
  明确错误，指明缺失的变量名与配置文件 `.env.local`。
- **为什么**：兜底会在生产漏配环境变量时静默连到本地空库，症状是"用户数据莫名丢失"，排查成本极高；
  启动即报错比带着错库跑更安全。
- **替代**：只在生产环境去掉兜底、开发保留（两套行为、易被误配绕过）；只在启动日志里 warn（照样能跑错库）。
- **影响**：本地开发必须存在 `.env.local`（模板见 `.env.example`）；CI/部署漏配变量会 fail fast，属预期行为。

## D-014 · 2026 · 验证码登录用 Credentials + JWT session（不落 sessions 表）

- **决策**：P0-03 用 Auth.js `Credentials` provider 承载邮箱验证码登录，session 策略显式设为 `jwt`，
  不为登录写 `sessions` 表；`users` 表在验证码校验通过时由我们 `upsert`。本轮**不装** `@auth/prisma-adapter`。
- **为什么**：Auth.js 的 Credentials provider **只支持 JWT session**（官方限制），与 PrismaAdapter 的
  database session 天然冲突。选 A 是官方唯一支持的路径；备选 B（自己校验验证码再用 Auth.js 手动建 session）
  要自己重写签发/刷新/注销/CSRF，而 v5 没有公开的"建 session"API，只能碰内部实现，更脆弱也更容易出安全漏洞。
- **adapter 兼容性（实测，非推测）**：`@auth/prisma-adapter@2.11.3` 的 peerDependencies 为
  `@prisma/client >=2.26 || >=3 || >=4 || >=5 || >=6`，**不含 7**；且 Prisma 7.10.1 的 `@prisma/client`
  已是空壳（`default.d.ts` 只有 `export * from '.prisma/client/default'`，而本仓库 `node_modules/.prisma`
  不存在 —— client 由新 generator 输出到 `src/generated/prisma`），adapter 内的
  `import type { PrismaClient } from "@prisma/client"` 在类型层解析不出来。故本轮不引入 adapter。
- **替代**：B（自己签 JWT cookie / 手动建 session）—— 重造轮子；database session + 魔法链接 `Email` provider
  —— 与产品要的"输 6 位码"交互不符。
- **影响**：`sessions` 表在 P0-03 为空表（JWT 不落库）；`Account`/`sessions` 相关能力留到 P0-04。
  P0-04 接 Bangumi OAuth 时需重审：OAuth 可与 jwt 策略共存，但写 `accounts` 表仍要 adapter，
  届时要么等 adapter 支持 Prisma 7，要么自写一个薄 adapter（Auth.js Adapter 接口约 10 个方法）。
  JWT 里只放 `sub`（userId）与 email，不放任何敏感数据。

---

## D-015 · 2026 · Bangumi 绑定走手写授权码流程（不注册 Auth.js provider），端点逐条查证

- **决策**：P0-04 的「绑定 Bangumi」**不复用 Auth.js 的 OAuth provider**，而是自己写授权码流程：
  `GET /api/auth/bangumi/start` 生成 `state` → 存 httpOnly cookie → 302 到 Bangumi 授权页；
  `GET /api/auth/callback/bangumi` 校验 `state` → 换 token → `GET /v0/me` 确认身份 →
  **由我们自己的代码** `prisma.account.upsert` 落库。`src/lib/auth.ts` 本轮**没有改动**。
- **为什么（语义分离）**：本站登录已经由邮箱验证码 + JWT session 完成，本轮要的是"绑定到当前账号"，
  不是"用 Bangumi 登录"。把 Bangumi 注册成 Auth.js provider 会把用户送进"OAuth 登录 → 可能创建/切换用户"
  那条路径，与"当前登录用户绑定一个外部账号"不是一回事；不注册 provider，这条歧义路径根本不存在。
- **为什么（没有 adapter，谁写 token）**：D-014 已确定不装 `@auth/prisma-adapter`，所以 Auth.js 不会替我们写
  `accounts`。写库点只有一个：回调路由里换到 token 且 `/v0/me` 成功之后的那次 `upsert`
  （`src/lib/bgm/binding.ts` 的 `bindBangumiAccount`）。`expires_at = floor(now/1000) + expires_in`。
- **为什么（选 A 而不是 B）**：① Auth.js 的 OAuth 流程在没有 adapter 时无处落库，B 会退化成
  "在 `signIn` 回调里自己写库还要绕过它的登录语义"，等于 A 多绕一圈；② 错误处理可控 ——
  用户取消（`error=access_denied`）、授权码 60 秒过期、token 失效都能 redirect 成中文提示，
  而不是 Auth.js 的默认 Error 页；③ 回调地址 `http://localhost:3000/api/auth/callback/bangumi` 已在 Bangumi 后台登记，
  自写路由能保证路径字面不变；④ 以后接 AniList 可整份复制。
- **端点核实（2026-10-25，实测下载规范比对，非凭记忆）**：
  - 出处：`github.com/bangumi/api` 的 `docs-raw/How-to-Auth.md` 与 `open-api/v0.yaml`
    （`/v0/me` 在 1025 行起，`/v0/users/{username}/collections` 在 1064 行起，
    `Paged_UserCollection` 在 3115 行起，`User` 在 2052 行起）。逐条结论已抄进 `src/lib/bgm/api.ts` 顶部注释。
  - 授权页 `GET https://bgm.tv/oauth/authorize`：`client_id`、`response_type=code`、`redirect_uri`、`state`。
    **`scope` 文档标注「尚未实现」→ 本项目一律不传**（不是漏传，是刻意不传）。
  - 换 token `POST https://bgm.tv/oauth/access_token`：`grant_type=authorization_code` + `client_id` +
    `client_secret` + `code` + `redirect_uri`，返回 `access_token` / `expires_in`(604800 秒 = 7 天) /
    `refresh_token` / `user_id`；刷新用同一端点的 `grant_type=refresh_token`（本轮不实现，字段照存）。
  - 调用 API：`Authorization: Bearer <token>`；`/v0/` **不支持** query string 传 token。
    OAuth 域名是 `bgm.tv`、API 域名是 `api.bgm.tv`，不可互换。
  - `User-Agent` 必须是「开发者 ID/应用名」，本项目统一 `shiyu/juhuang-chufang`，**每个**请求都带
    （含 `/v0/me` 与换 token 请求），禁用 `Bangumi/1.0`、`database` 这类泛化值。
- **用户名与收藏总数（也是查证结果）**：
  - `GET /v0/me` 返回的 `User` 同时有 `username`（唯一名，初始=UID，可改一次，做 URL 路径参数）与
    `nickname`（显示昵称）。**页面显示 `nickname`**（用户在 Bangumi 主页看到的就是它），
    路径参数用 `username`，二者不混用。响应里的 `email` 属于隐私字段，本项目不取、不存、不显示。
  - **收藏总数**：`GET /v0/users/{username}/collections` 的响应 `Paged_UserCollection` 自带 `total` 字段，
    所以一次 `limit=1&offset=0` 读 `total` 即可，不需要按 `subject_type` 累加、也不拉全量。
    口径是**所有条目类型的收藏合计**（`subject_type` 省略=全部），因此页面文案写「收藏总数 N 条」，
    不写「N 部动画」。`subject_type` 枚举：1 书籍 / 2 动画 / 3 音乐 / 4 游戏 / 6 三次元（没有 5）。
- **落库去向（任务卡第 6 步要求自行判断并记录）**：`accounts.provider_account_id` 存 **Bangumi 数字用户 id**
  （字符串形式，如 `"12345"`），`provider` 固定 `bangumi`。`username`/`nickname` **不落库**：
  `accounts` 表没有对应列，而 `prisma/schema.prisma` 不在本卡允许修改范围，所以显示时用存下的 token
  现查 `/v0/me`（进程内缓存键 = `account.id + expires_at`，5 分钟）。代价：token 过期后设置页只能提示重新绑定（见 T-010）。
- **`state` 防 CSRF**：24 字节随机数，`httpOnly` + `SameSite=Lax` + `Max-Age=600`（授权码本身 60 秒有效），
  回调时 query 与 cookie 必须**完全相等**且 cookie 一次性清除；不相等一律回 `/settings?bgm=state`。
  用户取消（`error=access_denied`）也要求"确实由本站发起"（有 state cookie）才认定为取消。
- **替代**：B（注册 Auth.js provider，在 `signIn` 回调里决定是否写库）—— 见上"为什么选 A"。
- **影响**：`accounts` 表里 bangumi 行的唯一写入方是本项目代码；`sessions` 表仍为空（JWT）；
  解绑只删当前用户自己的那条记录；一个本站用户只保留一条 bangumi 记录（换绑时先删旧行）；
  同一个 Bangumi 账号被第二个本站账号尝试绑定时拒绝（`/settings?bgm=taken`），不抢走已有绑定。

---

## D-016 · 2026 · 本地开发必须用 `pnpm dev:proxy` 启动（Node 的 fetch 不读系统代理）

- **决策**：新增 `scripts/dev.ps1` 与 `package.json` 的 `dev:proxy` —— 启动前读 Windows 系统代理
  （`HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyServer`），
  设置 `HTTPS_PROXY` / `HTTP_PROXY` **以及 `NODE_USE_ENV_PROXY=1`**，再执行 `pnpm dev`。
  `pnpm dev` 本身不改，留给"能直连"的环境（CI、生产）。
- **为什么**：Node 24 的 `fetch`（undici）**不读 Windows 系统代理**。只导出 `HTTPS_PROXY` 时它仍然直连，
  而本机对 `bgm.tv` / `api.bgm.tv` 的 DNS 解析到的地址 443 不通，表现为 10 秒后 `TypeError` 超时，
  用户看到的是「连不上 Bangumi」，很容易误判成 Bangumi 挂了或凭据错了（这就是 T-011 的真实原因）。
  `NODE_USE_ENV_PROXY=1` 是 Node 24 的内置开关，让 `fetch` 识别环境变量代理，**不需要任何新依赖**。
- **实测证据（2026-10-25，本机代理 `http://127.0.0.1:7897`，请求 `GET https://api.bgm.tv/v0/me`）**：

  | 环境变量 | 结果 |
  |---|---|
  | 全不设 | `FAIL TypeError in 10676ms`（直连超时） |
  | 只设 `HTTPS_PROXY` + `HTTP_PROXY` | `FAIL TypeError in 10660ms`（**仍直连**，证明只设无效） |
  | 再设 `NODE_USE_ENV_PROXY=1` | `status=401 in 457ms`（无 token 返回 401，即成功连通） |

  同一天在 dev server 内实测：带代理时换 token 真实往返；把代理指向死端口（`http://127.0.0.1:9`）
  重启后，回调稳定落到 `/settings?bgm=network`，而不是误报「授权码过期」。
- **替代**：手动 `$env:HTTPS_PROXY=...`（每次开终端都要记得，IDE 内建终端还会继承不到）；
  改 npm 全局 `proxy` 配置（只影响 npm，不影响 Node 的 `fetch`）；装 `undici` 的 `ProxyAgent` 手动挂 dispatcher
  （要改业务代码并加依赖，超出了本地环境的范畴）。
- **影响**：只有本地 dev 需要代理，生产服务器直连 `bgm.tv` 不受影响；
  `scripts/dev.ps1` 以 UTF-8 **带 BOM** 保存，否则 Windows PowerShell 5.1 会把中文提示读成乱码；
  系统没设代理时脚本原样 `pnpm dev`，不改变直连行为。

## D-017 · 2026 · `better-sqlite3` 钉死 12.11.1，随 adapter 走、不单独升大版本

- **决策**：`package.json` 写 `"better-sqlite3": "12.11.1"`（精确版本，不带 `^` / `~`），
  与 `@prisma/adapter-better-sqlite3@7.10.1` 声明的 `^12.6.0` 对齐；全仓库只允许存在一个 better-sqlite3。
- **为什么**：
  - adapter 把 better-sqlite3 放在 **`dependencies`**（不是 `peerDependencies`）里，pnpm 会为它单独装一份；
    根依赖只要填了另一个大版本，就必然双份共存（T-007 的实况：13.0.3 + 12.11.1）。
  - 业务代码从不直接 `import "better-sqlite3"`（`src/lib/db.ts` 只用 `PrismaBetterSqlite3({ url })`），
    所以根依赖的版本对运行时没有正向作用，只会制造"哪份在被加载"的不确定性。
  - 13.x 不是"更好的版本"而是**换了发行模型**：`gypfile: false`、无 `install` 脚本、二进制以
    `prebuilds/<platform>.node` 随包发布（`engines.node: ">=22"`）。adapter 的 `^12.6.0` 明确不接受 13.x，
    硬升等于替 adapter 做未验证的兼容性押注。
- **替代**：
  - `pnpm.overrides` 把 adapter 的 12 强行提到 13 —— 跨大版本 API 未经 adapter 验证，风险最高，否决。
  - 方案 B「让 13.0.3 能装出二进制」—— 前提就不成立：13.x 不跑构建脚本，把它加进白名单也没有任何效果。
  - 干脆删掉根依赖、只留 adapter 传递的那份 —— 版本会变成"由 adapter 的 semver 范围决定"，静默漂移更难察觉；
    显式写死反而把"我们用哪个版本"钉在明面上。
- **影响**：升级 `@prisma/adapter-better-sqlite3` 时，必须同时检查它声明的 better-sqlite3 范围，
  然后把根依赖一起改到同一版本；`pnpm why better-sqlite3` 出现两种版本即视为回归。

## D-018 · 2026 · `serverExternalPackages` 是原生模块的必需配置，不是 workaround（不要删）

- **决策**：保留 `next.config.ts` 的 `serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"]`，
  并把注释改写成"必需配置 + 理由"，防止后来者把它当临时兜底删掉。
- **为什么（依据官方文档，不凭直觉）**：
  - Next.js 15 官方文档 *serverExternalPackages*：Server Components / Route Handlers 里的依赖默认会被打包；
    使用 Node.js 专有能力的依赖可以 opt-out、改由 Node 原生 `require` 解析。原生 `.node` 模块正是这一类。
  - 本机 `next@15.5.28` 的 `dist/lib/server-external-packages.json` 里**已经有** `better-sqlite3` 与 `@prisma/client`，
    但**没有** `@prisma/adapter-better-sqlite3`。
  - 该 adapter 需要在运行时沿 better-sqlite3 的 `require` 路径找 `.node`（12.x 是 `build/Release/`，
    13.x 是 `prebuilds/`）；一旦被打包，`__dirname` 与相对路径被重写到 `.next/`，
    结果就是 `Could not locate the bindings file`。
  - 技术债条目里"移除 workaround 复测"这句**是错的**，已在 PROGRESS T-007 中纠正并留档。
- **替代**：只列 `@prisma/adapter-better-sqlite3`（依赖 Next 内置列表覆盖 better-sqlite3）—— 能跑，
  但内置列表随 Next 版本增删，升 Next 时可能悄悄失效；两个都显式列出成本为零。
- **影响**：只要项目还用 SQLite + 原生 driver，这条配置就不能删；挑选 Native 模块新增依赖时，
  需同样评估是否要加入此列表。

## D-019 · 2026 · 底部导航 `md:hidden` + 保留「我的」页里的「设置」入口

- **决策**：`src/components/bottom-nav.tsx` 只在 `<768px` 出现（`md:hidden`），桌面端隐藏；
  「我的」页那条通往 `/settings` 的按钮**保留**，不删。同时 `layout.tsx` 的底部留白在桌面端归零（`md:pb-0`）。
- **为什么**：底部导航是手机场景的产物，桌面上一条常驻底栏既突兀也没必要。
  但一旦隐藏，桌面端就**没有别的路进设置页**了 —— 首页只有「开始」、登录后落在「我的」，
  除了在地址栏手输 `/settings`，用户到不了 Bangumi 绑定。
  所以这两件事必须成对决定：**要么导航全端常驻并删掉页内入口，要么导航只在手机出现并留着页内入口。**
  选后者：桌面上是一个普通的多页网站，页内链接才是自然导航。
- **替代**：
  - 导航全端常驻 + 删掉「我的」页的设置按钮 —— 手机端最干净，但桌面端底部多一条与内容无关的横条。
  - 导航 `md:hidden` + 删掉页内入口 —— **不可接受**：桌面端设置页无法到达。
  - 用媒体查询在桌面端把导航变侧栏 —— 超出"骨架"范围，属于视觉/布局设计，留到后面。
- **影响**：手机上「我的」页有一个与底栏重复的「设置」入口，这是**刻意保留**的冗余，不是漏删。
  若以后做桌面端导航（侧栏/顶栏），应同时删掉这条页内入口，别让两个入口长期并存。
- **落地细节**：`/` 只在精确匹配时高亮（否则所有路径都会命中它），其余按前缀匹配；
  当前页除了颜色还给 `aria-current="page"`，不只靠视觉区分。

## D-020 · 2026 · 移动端基线：`dvh` + 安全区 + `color-scheme: dark` 最小深色可读

- **决策**（四条，都是"以后所有页面默认遵守"的基线）：
  1. 高度用 `min-h-dvh`（`100dvh`）而不是 `100vh`；外壳高度只由 `layout.tsx` 的那一个 `div` 决定，
     页面自身不再写 `min-h-screen`，改为 `flex-1` 撑满。
  2. `viewport` 导出里 `viewportFit: "cover"`，配合底部导航的 `padding-bottom: env(safe-area-inset-bottom)`；
     外壳的底部留白写成 `calc(56px + env(safe-area-inset-bottom))`，与导航条高**同源**
     （`--bottom-nav-height` 一个变量，两处共用，避免数字漂移导致内容被导航压住）。
  3. 横向溢出在 `html, body` 上一刀切掉（`max-width: 100%; overflow-x: hidden`），
     单页出现溢出时先修那个元素，而不是靠这条兜底掩盖。
  4. 深色模式**只做可读**：`@media (prefers-color-scheme: dark)` 里除了换背景/前景色，
     必须给 `:root { color-scheme: dark }` —— 否则原生输入框仍是浅色底、文字却是继承来的浅色，
     直接白底白字。顺带把两处"深色下会变暗色压暗色"的硬编码 `text-neutral-700/600` 去掉/提亮一档。
- **为什么**：
  - `100vh` 在 iOS/Android 地址栏收放时会跳动，`dvh` 跟随可视视口，是现在的标准做法。
  - `env(safe-area-inset-bottom)` 只有配 `viewport-fit=cover` 才拿得到值，两者缺一不可。
  - 深色模式的做法是"最小可读"，**不是**做深色主题：完整主题要等设计，这轮做了也是重做。
- **替代**：底部留白直接在每页写 `pb-24` —— 一旦改导航高度就全站错位；
  用 `position: sticky` 底栏 —— 长页面滚动时会被内容推开，且在某些 WebView 里表现不一致。
- **影响**：后面新增页面**不要**再写 `min-h-screen` / `h-screen`；需要"占满一屏"就用 `flex-1`（外壳已经是 `min-h-dvh` 的纵向 flex）。
  新增 fixed 元素前先问自己是不是底部导航的同类需求 —— 除它之外这轮不允许 `position: fixed`（iOS 键盘弹起时会错位）。

---

## 待决

| 编号 | 待决问题 | 影响 |
|---|---|---|
| Q-001 | 时长维度保留几档 | 诊断步骤数 |
| Q-002 | 首发推送渠道：邮件 / Bark | P3 工期 |
| Q-003 | 社交层（好友评分）是否首发 | 推荐精度 vs 上线速度 |
# 任务卡：P0-06 部署到公网

- **阶段**：P0 地基
- **预计耗时**：2–4 小时（自建需加备案时间，不含在内）
- **依赖**：P0-05

## 目标（一句话）

拿到一个手机和电脑都能打开的公网地址，能完成登录，且重启后数据还在。

## 允许修改

- `prisma/schema.prisma`（仅更换 datasource）
- `package.json`（构建脚本）
- `next.config.ts`
- `.env.example`、`README.md`
- 部署配置文件（`vercel.json` 或 `Dockerfile`，二选一）

## 禁止

- 不改业务逻辑
- 不把任何密钥写进仓库
- 不在本轮做域名购买与 ICP 备案（那是你的线下动作，与代码无关）

## ⚠️ 先做一个决定：数据库

**SQLite 在 Vercel 这类 Serverless 平台上不可用**——没有持久磁盘，每次部署/冷启动都会丢数据。
所以先二选一，并写进 `DECISIONS.md`：

| 方案 | 数据库 | 适合 | 代价 |
|---|---|---|---|
| **A 托管** | Neon / Supabase（Postgres） | 想最快上线、不想运维 | 免费额度够用，需改 `provider = "postgresql"` 并重新 migrate |
| **B 自建** | 保留 SQLite | 有服务器（VPS）、想省钱 | 要自己装 Node、配 systemd/PM2、上 HTTPS |
| **C 折中** | Turso（libSQL） | 想留在 Vercel 又不想换 SQL 方言 | 需装 `@libsql/client` adapter |

> 推荐 **A**：迁移成本低，P2 的批量计算也不会被 I/O 拖慢。

## 步骤

### 若选 A（托管 + Vercel）

1. 在 Neon/Supabase 建库，拿到连接串（注意要带 `?sslmode=require`）
2. `schema.prisma` 改 `provider = "postgresql"`
3. 本地 `.env.local` 换成云库连接串，跑 `pnpm prisma migrate deploy`
4. 推到 GitHub，Vercel 导入项目
5. 在 Vercel 环境变量里配齐：`DATABASE_URL`、`AUTH_SECRET`、`BANGUMI_*`、`RESEND_API_KEY`
6. **回调地址要改**：Bangumi 后台把回调改成 `https://<域名>/api/auth/callback/bangumi`
7. 部署后重跑一次 `prisma migrate deploy`（用 Vercel 的 build command 或本地连生产库跑）

### 若选 B（自建 VPS）

1. 服务器装 Node 20+、pnpm、Caddy 或 Nginx
2. `git clone` → `pnpm install` → `pnpm build`
3. PM2 启动 `pnpm start`，端口 3000
4. Caddy 反代 + 自动 HTTPS
5. 数据库文件放在**仓库目录之外**（如 `/var/data/dev.db`），并把 `DATABASE_URL` 指过去
6. 配置 systemd/PM2 开机自启

## 验收

**公网**

- [ ] 手机 4G（不用 WiFi）访问公网地址，首页能打开
- [ ] 完成一次邮箱登录
- [ ] 设置页能绑定 Bangumi（用域名回调，不再用 localhost）

**数据持久**

- [ ] 重启服务后，之前登录的账号与处方记录仍在
- [ ] 部署第二次（触发重新构建）后，数据没丢

**安全**

- [ ] 公网地址不能直接访问 `.env.local`、`prisma/dev.db`
- [ ] 页面源码里搜不到密钥
- [ ] 关闭 dev 模式（`NODE_ENV=production`）

## 完成定义

- 上述全部通过
- 公网地址与选定方案写入 `DECISIONS.md`
- `PROGRESS.md` 更新为 6/6（P0 收尾）
- git commit + 打 tag `v0.1-foundation`

## 给 AI 的备注

- **不要**在未确认数据库方案前直接部署 Vercel，SQLite 会静默丢数据，很难排查。
- Prisma 在 Serverless 上连接池容易打满，连接串加 `?connection_limit=1` 或使用 Neon 的 pooler 地址。
- 环境变量改动后必须**重新部署**才生效，改完等构建完成再测。
- 若你不确定目标用户的网络环境，先不要纠结访问速度，能打开就够。
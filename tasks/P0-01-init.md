# 任务卡：P0-01 项目初始化

- **阶段**：P0 地基
- **预计耗时**：1–2 小时
- **依赖**：无

## 目标（一句话）

从空目录变成一个 `pnpm dev` 能跑、`pnpm build` 能过的 Next.js 项目骨架。

## 允许修改

- `package.json`、`pnpm-lock.yaml`
- `next.config.ts`、`tsconfig.json`、`tailwind.config.ts`、`postcss.config.mjs`
- `src/`（仅初始化生成的骨架）
- `.gitignore`、`.env.example`

## 禁止

- 不写任何业务逻辑（诊断、处方、账号都不做）
- 不装 Prisma / Auth.js（下一张卡再装）
- 不设计页面视觉

## 步骤

1. 在 `D:\animation app` 初始化 Next.js 15：

   ```powershell
   pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
   ```

   > 目录非空（已有 md 文件）时 CLI 会提示，选择保留现有文件。

2. 装 ESLint 与格式化（单独装，避免 CLI 交互）：

   ```powershell
   pnpm add -D eslint eslint-config-next prettier
   ```

3. 建 `.env.example`，先写占位：

   ```
   DATABASE_URL="file:./dev.db"
   AUTH_SECRET=""
   BANGUMI_CLIENT_ID=""
   BANGUMI_CLIENT_SECRET=""
   BANGUMI_REDIRECT_URI="http://localhost:3000/api/auth/callback/bangumi"
   RESEND_API_KEY=""
   ```

4. 建 `src/app/page.tsx` 最小首页，只放项目名与一句定位（不做设计）。

5. 把 `PRD/进度/决策/任务卡` 四个 md 排除在构建之外（它们不影响编译，无需处理）。

## 验收

**命令**

```powershell
pnpm install
pnpm build
pnpm lint
```

三条都必须成功退出（exit 0）。

**手测**

- [ ] `pnpm dev` 后打开 `http://localhost:3000`，页面正常显示
- [ ] 用手机（同 WiFi）访问 `http://<本机IP>:3000`，页面能打开
- [ ] 浏览器控制台无报错

**结构**

- [ ] 存在 `src/app/page.tsx`、`src/app/layout.tsx`
- [ ] 存在 `.env.example`，且真实 `.env.local` 已被 `.gitignore` 忽略

## 完成定义

- 上面全部通过
- `PROGRESS.md` 的 P0 完成度改成 1/7，当前任务改成 P0-02
- `git init` 并提交首个 commit

## 给 AI 的备注

- `create-next-app` 在非空目录会交互询问，**不要用 `--yes` 盲过**，看清楚每一问再答。
- 若 pnpm 未安装，先 `npm i -g pnpm`，不要改用 npm 混合使用（会锁文件冲突）。
- 端口 3000 被占用时用 `-p 3001`，并在验收记录里写明实际端口。
- 本轮不要碰 `产品框架.md / 实施计划.md / PROGRESS.md / DECISIONS.md` 的内容本身。
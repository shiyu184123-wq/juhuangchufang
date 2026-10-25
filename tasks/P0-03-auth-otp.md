# 任务卡：P0-03 邮箱验证码登录

- **阶段**：P0 地基
- **预计耗时**：2–3 小时
- **依赖**：P0-02

## 目标（一句话）

未登录的人能用邮箱收到验证码并登录，登录后能看到自己的邮箱，且能退出。

## 允许修改

- `src/lib/auth.ts`
- `src/app/api/auth/**`
- `src/app/login/**`
- `src/app/me/**`（仅显示邮箱的最小版本）
- `src/lib/mail.ts`
- `.env.example`

## 禁止

- 不做密码登录、不做注册表单（本产品只用验证码）
- 不接 Bangumi（下一张卡）
- 不做找回密码（验证码本身就是找回）
- 不在仓库里写真实 API key

## 步骤

1. 装认证与邮件依赖：

   ```powershell
   pnpm add auth@beta next-auth@beta
   pnpm add resend
   ```

2. 配置 `src/lib/auth.ts`。**注意**：Auth.js 的 `Email` provider 是**魔法链接**，不是验证码。
   用验证码有两种做法，选其一并在代码注释里写明：
   - **A（推荐）**：用 `Credentials` provider 自定义验证码校验
   - **B**：自己发 JWT cookie，不用 Auth.js 的 provider 体系

3. 生成 `AUTH_SECRET`：

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. 发码接口 `POST /api/auth/otp/send`：
   - 校验邮箱格式（zod）
   - **限流**：同一邮箱 60 秒内只能发一次；同一 IP 每小时最多 10 次
   - 生成 6 位数字码，**存 hash 不存明文**（bcrypt 或 sha256+salt）
   - 有效期 10 分钟
   - 发送成功后返回 200，**不返回验证码**

5. 校验接口 `POST /api/auth/otp/verify`：
   - 比对 hash，校验过期
   - 同一码最多试 5 次，超了就作废（`attempts` 字段）
   - 校验通过：不存在则建 User，然后创建会话
   - 失败统一返回"验证码无效或已过期"，**不提示具体是哪种失败**

6. 登录页 `/login`：输入邮箱 → 发送 → 输入 6 位码 → 提交 → 跳转 `/me`
   - 移动端：输入框 `inputMode="numeric"`，按钮 ≥ 44px

7. 邮件模板（`src/lib/mail.ts`）：纯文本即可，主题"你的登录验证码"，正文含码与 10 分钟有效期声明。

## 验收

**命令**

```powershell
pwsh -File .\scripts\check.ps1
```

**手测**

- [ ] 输入自己的邮箱，能收到验证码邮件（检查垃圾箱）
- [ ] 输入正确验证码 → 进入 `/me`，页面显示该邮箱
- [ ] 故意输错 5 次 → 第 5 次后该码失效，必须重新发送
- [ ] 60 秒内连点两次"发送" → 第二次被拒绝并提示
- [ ] 刷新页面仍处于登录态；点退出后回到未登录
- [ ] 手机浏览器上完成一次完整登录

**安全**

- [ ] 数据库 `EmailCode.codeHash` 里看不到明文验证码
- [ ] 接口响应里不含验证码字段
- [ ] `.env.local` 不在 git 里

## 完成定义

- 上述全部通过
- `PROGRESS.md` 更新为 3/7
- git commit

## 给 AI 的备注

- **邮件送达是国内最大的坑**。先用 Resend 的测试域名发到自己邮箱；如果进垃圾箱，
  在任务卡里记下，别在本轮反复折腾 SMTP 配置。
- 验证码判断必须**常数时间**比较，别用 `===` 直接比明文（存 hash 后比 hash 是安全的）。
- 限流先做内存版（单实例够用），不要为 P0 引入 Redis。
- 不要给登录接口加过于复杂的 CSRF 逻辑，Next.js Route Handler 的 POST + SameSite cookie 已够用，写注释说明即可。
# 任务卡：P0-04 Bangumi 授权绑定

- **阶段**：P0 地基
- **预计耗时**：2–3 小时（含查文档）
- **依赖**：P0-03

## 目标（一句话）

已登录用户能绑定自己的 Bangumi 账号，绑定成功后设置页显示其 Bangumi 用户名与收藏总数。

## 允许修改

- `src/lib/bgm/**`
- `src/lib/auth.ts`（仅新增 provider）
- `src/app/api/auth/**`
- `src/app/settings/**`
- `.env.example`

## 禁止

- **不要凭记忆写端点**。第一步就是查文档并把确认结果写进注释。
- 本轮不拉取全量收藏（只拉数量与用户名），不建 `user_ratings`
- 不做 AniList
- 不把 access_token 明文写日志

## 步骤

1. **查文档（必须）**，在 `src/lib/bgm/api.ts` 顶部注释里记下你确认到的内容：
   - Bangumi 开发者文档 / OAuth 页面地址
   - 授权端点、token 端点、scope 名称
   - 用户信息接口与所需请求头

   > 参考（**必须核实后使用**，端点可能变动）：
   > - 授权页 `https://bgm.tv/oauth/authorize`
   > - 取 token `https://bgm.tv/oauth/access_token`
   > - 用户信息 `GET https://api.bgm.tv/v0/me`
   > - 用户收藏 `GET https://api.bgm.tv/v0/users/{username}/collections`
   > - 请求需带自定义 `User-Agent`（官方要求，缺失会被拒）

2. 在 Bangumi 后台注册应用，回调地址填 `http://localhost:3000/api/auth/callback/bangumi`
3. 在 `src/lib/auth.ts` 里**自定义 provider**（Auth.js 无内置 Bangumi）：

   ```ts
   {
     id: 'bangumi',
     name: 'Bangumi',
     type: 'oauth',
     authorization: { url: '<核实后的授权端点>', params: { scope: '<核实>' } },
     token: '<核实后的 token 端点>',
     userinfo: '<核实后的用户信息端点>',
     clientId: process.env.BANGUMI_CLIENT_ID,
     clientSecret: process.env.BANGUMI_CLIENT_SECRET,
     profile(profile) { /* 映射成 { id, name, image } */ }
   }
   ```

4. 封装 `fetchBgm(path)`：统一加 `User-Agent` 头、统一错误处理、失败时返回结构化错误而不是抛裸异常。
5. 设置页 `/settings`：
   - 未绑定时显示"绑定 Bangumi"按钮
   - 已绑定时显示用户名、收藏总数、"解绑"按钮
6. 绑定成功后立即调一次 `/v0/me`，把 username 存到 Account 的 `providerAccountId`（或新增字段，自行判断并记录到 DECISIONS）

## 验收

**命令**

```powershell
pwsh -File .\scripts\check.ps1
```

**手测**

- [ ] 点"绑定 Bangumi" → 跳到 Bangumi 授权页 → 授权后回到本站
- [ ] 设置页显示正确的 Bangumi 用户名
- [ ] 显示收藏总数，且与你账号里实际数字一致
- [ ] 解绑后回到未绑定状态，再绑一次仍成功
- [ ] 授权被用户拒绝（在 Bangumi 页点取消）时，本站给出友好提示而不是白屏

**安全**

- [ ] access_token 不出现在页面、日志、客户端 bundle 里
- [ ] `BANGUMI_CLIENT_SECRET` 只存在于服务端环境变量

## 完成定义

- 上述全部通过
- 在 `DECISIONS.md` 追加一条：Bangumi 端点核实结果与版本日期
- `PROGRESS.md` 更新为 4/6
- git commit

## 给 AI 的备注

- **这是全项目最容易卡住的一张卡**。80% 的失败来自三处：回调地址不匹配、缺 `User-Agent`、scope 写错。
  按这三条逐个排查，不要在别处乱试。
- 本地回调用 `localhost` 而不是 `127.0.0.1`，两者在 Bangumi 后台算不同地址。
- 手机上测绑定会失败（回调指向 localhost），这是正常的，在局域网 IP 上验证或直接跳过手机测试。
- 如果连续两次授权失败，**停下来把完整报错和请求贴出来**，不要继续改代码。
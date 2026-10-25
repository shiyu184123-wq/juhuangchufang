# 任务卡：P0-05 页面骨架与移动端基线

- **阶段**：P0 地基
- **预计耗时**：1.5 小时
- **依赖**：P0-03（登录页已存在）

## 目标（一句话）

三个页面（首页 / 登录 / 我的）在手机上打开不横向滚动、点击不误触、切换顺畅。

## 允许修改

- `src/app/layout.tsx`、`src/app/page.tsx`
- `src/app/me/**`、`src/app/settings/**`（布局层面）
- `src/components/**`
- `src/app/globals.css`

## 禁止

- 不做视觉设计（配色、插画、动效都留到后面）
- 不装 UI 组件库（shadcn/antd 都不装，保持 Tailwind 原味）
- 不做诊断与处方路由

## 步骤

1. `layout.tsx` 设置移动端 viewport 与主题色：

   ```ts
   export const viewport = {
     width: 'device-width',
     initialScale: 1,
     viewportFit: 'cover',   // 适配刘海屏安全区
     themeColor: '#ffffff',
   }
   ```

2. 建底部导航 `src/components/bottom-nav.tsx`：三个入口（首页 / 我的 / 设置），
   固定底部、高度 ≥ 56px、带 `env(safe-area-inset-bottom)` 内边距。

3. 首页放一句定位文案 + 一个主按钮（暂指向登录或占位），不做排版花活。

4. 全局样式补充：

   ```css
   html, body { max-width: 100%; overflow-x: hidden; }
   button, a { min-height: 44px; }   /* 触控区下限 */
   ```

5. 给所有交互元素加 `:focus-visible` 描边，保证键盘可达。

## 验收

**命令**

```powershell
pwsh -File .\scripts\check.ps1
```

**手测（在真实手机上，不要只用浏览器模拟）**

- [ ] 三个页面都能打开，无横向滚动条
- [ ] 底部导航不被系统手势条遮挡
- [ ] 所有按钮一次点中，不需要点第二次
- [ ] 字体不小于 14px，正文可读
- [ ] 横屏下布局不崩
- [ ] 深色模式下文字仍可读（`prefers-color-scheme`）

## 完成定义

- 上述全部通过
- `PROGRESS.md` 更新为 5/7
- git commit

## 给 AI 的备注

- 移动端最常见的问题是 `100vh` 在浏览器地址栏收放时跳动，用 `100dvh` 代替。
- 不要用 `position: fixed` 做底部导航之外的东西，容易在 iOS 上出问题。
- 本轮**不要**追求好看。任何"美化"都是在浪费后面要重做的工。
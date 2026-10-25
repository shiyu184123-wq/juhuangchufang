import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚠️ 这是原生模块的【必需配置】，不是 workaround，也不要"为了干净"删掉。
  //
  // 依据 Next.js 15 官方文档（serverExternalPackages）：使用 Node.js 专有能力的依赖
  // 可以不进 Server Components 打包、改由 Node 原生 require 解析。
  //
  // 为什么这里必须 externalize：
  // - better-sqlite3 和 @prisma/adapter-better-sqlite3 都要在运行时定位 .node 二进制
  //   （前者 build/Release/better_sqlite3.node，后者沿 better-sqlite3 的 require 路径找）。
  //   一旦被打包，__dirname / 相对路径会被重写到 .next/，运行时就是
  //   "Could not locate the bindings file"。
  // - better-sqlite3 本就在 Next 内置 external 列表里（next/dist/lib/server-external-packages.json），
  //   这里显式列出是双保险：内置列表会随 Next 版本变动，写死可避免升级后被重新打包。
  // - @prisma/adapter-better-sqlite3 【不在】内置列表里，它才是这条配置真正的理由。
  //   删掉它 → dev/build 下任何 DB 调用都会在加载 native binding 时崩。
  //
  // 版本策略（T-007）：better-sqlite3 固定 12.11.1，与 adapter 声明的 ^12.6.0 对齐，
  // 全仓库只有一份；不要因为"想用新版"就单独升根依赖，那会重新引入双版本。
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
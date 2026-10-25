import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块（依赖 .node 二进制）。如果让 Turbopack 打包它，
  // __dirname 会被重写到 .next 目录，运行时就会报 "Could not locate the bindings file"。
  // 交给 Node 的 require 直接解析，才能命中 node_modules 里编译好的 better_sqlite3.node。
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
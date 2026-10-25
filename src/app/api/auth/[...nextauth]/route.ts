import { handlers } from "@/lib/auth";

// Auth.js v5 走 App Router 的标准挂载点（/api/auth/*）
export const { GET, POST } = handlers;
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  readOAuthConfig,
} from "@/lib/bgm/api";

// 授权地址每次都要新生成（含一次性 state），不能被静态化
export const dynamic = "force-dynamic";

/**
 * 绑定入口：GET /api/auth/bangumi/start
 *
 * 这是「绑定」而不是「登录」：先要求本站已有人登录（JWT session），
 * 再把他带到 Bangumi 授权页。回调见 /api/auth/callback/bangumi（后台已登记该地址）。
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  // 没登录就拒绝，不发授权请求 —— 否则回调时无从知道要绑给谁
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const config = readOAuthConfig();
  if (!config.ok) {
    return NextResponse.redirect(new URL("/settings?bgm=config", req.url));
  }

  // state：24 字节随机数，httpOnly cookie 存一份，授权页带一份，回调时比对
  const state = randomBytes(24).toString("base64url");
  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.data.clientId,
    redirectUri: config.data.redirectUri,
    state,
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  return response;
}
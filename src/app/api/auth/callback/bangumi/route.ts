import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  exchangeAuthorizationCode,
  getCollectionTotal,
  getMyself,
  OAUTH_STATE_COOKIE,
  readOAuthConfig,
} from "@/lib/bgm/api";
import { bindBangumiAccount } from "@/lib/bgm/binding";

// 回调必须每次实时处理（code 只有 60 秒有效期）
export const dynamic = "force-dynamic";

/**
 * Bangumi 授权回调：GET /api/auth/callback/bangumi
 *
 * 地址已在 Bangumi 后台登记为 http://localhost:3000/api/auth/callback/bangumi，
 * 不要改路径。本路由与 api/auth/[...nextauth]/route.ts 共存，静态段优先命中这里。
 *
 * 流程：校验登录 → 校验 state（CSRF）→ 换 token → /v0/me 取身份 → 落库。
 * 任何一步失败都 redirect 回 /settings?bgm=xxx 给中文提示，绝不白屏、绝不把 token 写日志。
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const oauthError = params.get("error");
  const code = params.get("code");
  const state = params.get("state");
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // state cookie 一次性：无论成功失败都清掉，避免重放
  const finish = (res: NextResponse) => {
    res.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  };
  const back = (reason: string) => finish(NextResponse.redirect(new URL(`/settings?bgm=${reason}`, req.url)));

  // 1) 回调到达时站点必须仍处于登录态，否则不知道该绑给谁
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return back("login");

  // 2) 用户在 Bangumi 授权页点了「取消」：只要确实由本站发起（有 state cookie）就按拒绝处理。
  //    这条分支不落库、不换 token，最多是被导航过来清掉自己的 cookie，无风险。
  if (oauthError) {
    const startedHere = Boolean(cookieState) && (!state || state === cookieState);
    return back(startedHere && oauthError === "access_denied" ? "denied" : startedHere ? "failed" : "state");
  }

  // 3) 换 token 前必须证明这次回调由本站发起：query state 必须与 httpOnly cookie 完全一致
  if (!state || !cookieState || state !== cookieState) return back("state");
  if (!code) return back("failed");

  const config = readOAuthConfig();
  if (!config.ok) return back("config");

  // 4) 换 token。code 只有 60 秒有效期，任何失败都提示重新绑定（常见：浏览器里放了很久再点回本站）
  const tokenResult = await exchangeAuthorizationCode({
    code,
    clientId: config.data.clientId,
    clientSecret: config.data.clientSecret,
    redirectUri: config.data.redirectUri,
  });
  if (!tokenResult.ok) return back("invalid_code");

  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = tokenResult.data;
  if (!accessToken) return back("invalid_code");

  // 5) 带 Bearer + User-Agent 调 /v0/me 确认身份（用户名/昵称都以这里为准，不信任 URL 参数）
  const me = await getMyself(accessToken);
  if (!me.ok) return back("profile");

  // 6) 收藏总数只取 total；失败不影响绑定成功（设置页会显示「—」）
  const total = await getCollectionTotal(accessToken, me.data.username);

  // 7) 落库：accounts 表存 token 与 7 天有效期，providerAccountId = Bangumi 数字 id
  const bindResult = await bindBangumiAccount({
    userId,
    bgmUserId: me.data.id,
    accessToken,
    expiresIn,
    refreshToken,
    tokenType: tokenResult.data.token_type,
    scope: tokenResult.data.scope,
  });
  if (!bindResult.ok) {
    return back(bindResult.reason === "taken" ? "taken" : "dbfail");
  }

  // 收藏数为 0 也视为成功；只有取不到时才带上提示标记
  return back(total.ok ? "ok" : "partial");
}
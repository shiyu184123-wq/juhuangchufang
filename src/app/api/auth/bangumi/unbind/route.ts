import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { unbindBangumiAccount } from "@/lib/bgm/binding";

export const dynamic = "force-dynamic";

/**
 * 解绑：POST /api/auth/bangumi/unbind
 *
 * 只删当前 JWT session 对应用户的那条 bangumi account（见 unbindBangumiAccount），
 * 不碰任何其他用户的记录。用表单 POST 而不是 server action 是为了不依赖 JS：
 * session cookie 是 SameSite=Lax，跨站 POST 带不上来，天然挡住 CSRF。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const result = await unbindBangumiAccount(userId);
  // 303 让浏览器把 POST 换成 GET 再跳，刷新不会重复提交
  return NextResponse.redirect(new URL(`/settings?bgm=${result.ok ? "unbound" : "dbfail"}`, req.url), {
    status: 303,
  });
}
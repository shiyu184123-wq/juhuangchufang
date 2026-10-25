import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBangumiCard } from "@/lib/bgm/binding";

// 绑定点会读 session + 打 Bangumi API，不能静态化
export const dynamic = "force-dynamic";

type NoticeTone = "ok" | "warn" | "error";

const NOTICES: Record<string, { tone: NoticeTone; text: string }> = {
  ok: { tone: "ok", text: "绑定成功。" },
  partial: { tone: "warn", text: "绑定成功，但收藏总数暂时没取到（稍后刷新会重试）。" },
  unbound: { tone: "ok", text: "已解绑 Bangumi。" },
  denied: { tone: "warn", text: "你在 Bangumi 授权页取消了授权，账号没有绑定。" },
  invalid_code: { tone: "warn", text: "授权已过期（授权码只有 60 秒有效期），请重新点一次绑定。" },
  state: { tone: "error", text: "授权校验失败（state 不匹配），请重新发起绑定。" },
  config: { tone: "error", text: "服务端没有配置 Bangumi 应用凭据，暂时无法绑定。" },
  profile: { tone: "error", text: "已拿到授权，但读取 Bangumi 用户信息失败，请重试。" },
  network: { tone: "error", text: "连不上 Bangumi 服务器（可能是网络或代理问题），请稍后重试。" },
  taken: { tone: "error", text: "这个 Bangumi 账号已经绑定了另一个本站账号。" },
  login: { tone: "warn", text: "请先登录，再发起 Bangumi 绑定。" },
  failed: { tone: "error", text: "绑定没有完成，请重试。" },
  dbfail: { tone: "error", text: "保存绑定关系失败，请重试。" },
  unknown: { tone: "error", text: "绑定没有完成，请重试。" },
};

const TONE_CLASS: Record<NoticeTone, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-900",
};

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-base text-white";
const SECONDARY_BUTTON =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-neutral-300 px-4 text-base text-foreground";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ bgm?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { bgm } = await searchParams;
  const notice = bgm ? (NOTICES[bgm] ?? NOTICES.unknown) : null;
  const card = await getBangumiCard(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm text-neutral-500">{session.user.email}</p>
      </header>

      {notice && (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASS[notice.tone]}`}>
          {notice.text}
        </p>
      )}

      <section aria-labelledby="bangumi-title" className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h2 id="bangumi-title" className="text-base font-medium">
          Bangumi 绑定
        </h2>

        {card.status === "unbound" && (
          <>
            <p className="text-sm text-neutral-500">
              绑定后可以读到你自己的收藏数，用来做更准的推荐。我们只读取用户名和收藏数。
            </p>
            {/*
              用原生 GET 表单跳转而不是 <a href> 或 <Link>：
              这是 route handler（不是页面），Link 会走客户端导航与预取，
              预取可能在用户没点之前就生成一次性 state cookie。
            */}
            <form action="/api/auth/bangumi/start" method="get">
              <button type="submit" className={PRIMARY_BUTTON}>
                绑定 Bangumi
              </button>
            </form>
          </>
        )}

        {card.status === "linked" && (
          <>
            <dl className="space-y-1 text-base">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-neutral-500">用户名</dt>
                <dd className="truncate font-medium">{card.nickname}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-neutral-500">唯一 ID</dt>
                <dd className="truncate text-sm text-neutral-500">@{card.username}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-neutral-500">收藏总数</dt>
                <dd className="font-medium">
                  {card.collectionTotal === null ? "—" : `${card.collectionTotal} 条`}
                </dd>
              </div>
            </dl>

            <form action="/api/auth/bangumi/unbind" method="post">
              <button type="submit" className={SECONDARY_BUTTON}>
                解绑
              </button>
            </form>
          </>
        )}

        {(card.status === "expired" || card.status === "error") && (
          <>
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {card.message}
            </p>
            <form action="/api/auth/bangumi/start" method="get">
              <button type="submit" className={PRIMARY_BUTTON}>
                重新绑定
              </button>
            </form>
            <form action="/api/auth/bangumi/unbind" method="post">
              <button type="submit" className={SECONDARY_BUTTON}>
                解绑
              </button>
            </form>
          </>
        )}
      </section>

      {/* 手机上是多余入口（底部导航有），但桌面端没有底部导航，这条是回到「我的」的路 */}
      <Link
        href="/me"
        className="flex min-h-[44px] items-center justify-center text-sm text-neutral-500 underline"
      >
        返回我的账号
      </Link>
    </main>
  );
}
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

// 最小版本：只确认"登录后能看到自己的邮箱，并且能退出"。
// 个人信息、处方列表等留到后续任务卡。
export default async function MePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">已登录</h1>
        <p className="text-sm text-neutral-500">这是你的账号：</p>
      </header>

      <p className="rounded-lg border border-neutral-200 px-4 py-3 text-base">
        {session.user.email}
      </p>

      {/*
        手机上这个入口和底部导航的「设置」重复，但底部导航在桌面端是隐藏的（md:hidden），
        这一条是桌面端进入设置页的唯一路径，所以保留。见 DECISIONS D-019。
      */}
      <Link
        href="/settings"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-neutral-300 px-4 text-base"
      >
        设置
      </Link>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-lg border border-neutral-300 px-4 text-base"
        >
          退出登录
        </button>
      </form>
    </main>
  );
}
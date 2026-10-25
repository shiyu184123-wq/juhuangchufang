import Link from "next/link";

// 本轮只要一句定位文案 + 一个主按钮。排版、配色、插画都留到后面，别在这里做视觉。
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">剧荒处方</h1>
      <p className="text-sm text-neutral-500">
        在你最想不出看什么的那一刻，给你一部，并说清为什么是它。
      </p>
      {/* 诊断路由还没有，先落到登录页 */}
      <Link
        href="/login"
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-neutral-900 px-6 text-base font-medium text-white"
      >
        开始
      </Link>
    </main>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 主场景是手机，桌面端（≥768px）不出现这条底栏，见 DECISIONS D-019。
const LINKS = [
  { href: "/", label: "首页" },
  { href: "/me", label: "我的" },
  { href: "/settings", label: "设置" },
] as const;

function isActive(pathname: string, href: string) {
  // 首页只在精确匹配时高亮，否则任何路径都会命中 "/"
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-background md:hidden"
      // 全面屏手势条的安全区只能靠 env() 让出来；viewportFit: "cover" + 这一行才生效。
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href} className="flex flex-1">
              <Link
                href={link.href}
                // 不只用颜色区分当前页：读屏/高对比度模式下 aria-current 才是可靠信号
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[var(--bottom-nav-height)] w-full items-center justify-center text-sm ${
                  active ? "font-medium text-foreground" : "text-neutral-500"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
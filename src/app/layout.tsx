import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "剧荒处方",
  description: "在你最想不出看什么的那一刻，给你一部，并说清为什么是它。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 配合底部导航的 env(safe-area-inset-bottom)：不回退到安全区外，才能给手势条让位
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          这里用 div 而不是 main：每个页面自己已经带了 <main>，再套一层会形成嵌套 main。
          - min-h-dvh 而不是 100vh：地址栏收放时 100vh 会跳。
          - 底部留白 = 导航条高 + 安全区，否则页面最下方的内容永远被 fixed 导航压住；
            桌面端导航隐藏（md:hidden），留白也一并去掉。
        */}
        <div className="flex min-h-dvh flex-col pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from "next";
import { HeaderSlot } from "@/components/auth/HeaderSlot";
import "./globals.css";

export const metadata: Metadata = {
  title: "赛博命理 · Cyber Divination",
  description:
    "八字、紫微、六爻专业排盘与典籍约束解读。传统文化学习与娱乐参考，不构成决策依据。",
  applicationName: "赛博命理",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * 根布局保持**同步**且不读取运行时 API。
 *
 * 会话读取已下沉到 `HeaderSlot`（内部用 `<Suspense>` 包裹）。
 * 这样首页、隐私政策、分享页等不依赖会话的路由可恢复静态预渲染，
 * 而登录态 UI 仍能在请求时流式补入。
 *
 * 切勿在此处直接调用 `cookies()` / `getServerSession()` —— 那会让
 * 整棵路由树退化为动态渲染（原先的缺陷即为此）。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col text-foreground bg-background">
        <HeaderSlot />
        {children}
      </body>
    </html>
  );
}

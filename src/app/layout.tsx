import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/auth/SiteHeader";
import { AuthModeSync } from "@/components/auth/AuthModeSync";
import { getServerSession } from "@/lib/auth/get-session";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col text-foreground bg-background">
        <AuthModeSync session={session} />
        <SiteHeader session={session} />
        {children}
      </body>
    </html>
  );
}

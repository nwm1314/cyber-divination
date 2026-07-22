import Link from "next/link";
import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/AccountPanel";
import { getServerSession } from "@/lib/auth/get-session";

export const metadata: Metadata = {
  title: "账号与数据 · 赛博命理",
  description: "导出数据、删除账号与云端档案。",
};

export default async function AccountPage() {
  const session = await getServerSession();

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full gap-4 pb-10">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 首页
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            账号与数据
          </h1>
          <Link
            href="/privacy"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            隐私
          </Link>
        </header>

        <AccountPanel session={session} />

        <p className="text-center text-xs text-muted">
          <Link href="/privacy" className="hover:text-cyan transition-colors">
            隐私政策
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Link href="/settings" className="hover:text-cyan transition-colors">
            本地设置
          </Link>
        </p>
      </div>
    </div>
  );
}

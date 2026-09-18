import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/AccountPanel";
import { getServerSession } from "@/lib/auth/get-session";

export const metadata: Metadata = {
  title: "账号与数据 · 赛博命理",
  description: "导出数据、删除账号与云端档案。",
};

/**
 * 会话读取封装为独立岛并用 `<Suspense>` 包裹：
 * `getServerSession()` 内部调用 `cookies()`（运行时 API），
 * 直接写在页面组件里会阻塞整页预渲染。
 * 见 Next.js 16 `01-app/01-getting-started/08-caching.md`。
 */
async function AccountPanelSlot() {
  const session = await getServerSession();
  return <AccountPanel session={session} />;
}

function AccountPanelFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-6 text-center">
      <p className="text-sm text-muted">正在读取账号信息…</p>
    </div>
  );
}

export default function AccountPage() {
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

        <Suspense fallback={<AccountPanelFallback />}>
          <AccountPanelSlot />
        </Suspense>

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

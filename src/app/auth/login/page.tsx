import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth";
import { getServerSession } from "@/lib/auth/get-session";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/**
 * 会话与 searchParams 均属运行时 API（`cookies()` / `searchParams`），
 * 必须整体封装进 `<Suspense>` 岛，否则会阻塞整页预渲染。
 * 见 Next.js 16 `01-app/01-getting-started/08-caching.md`。
 *
 * `searchParams` 以 Promise prop 传入（未 await），由本岛内部 await，
 * 避免在页面组件内访问运行时 API。切勿改用模块级变量传递 —— 那会在
 * 并发请求间互相覆盖。
 */
async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const [sp, session] = await Promise.all([searchParams, getServerSession()]);
  const callbackUrl =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/";

  if (!session.authenticated) {
    return <LoginForm callbackUrl={callbackUrl} />;
  }

  return (
    <div className="w-full rounded-xl border border-cyan/30 bg-surface/90 p-6 space-y-3 text-center">
      <p className="text-gold font-medium">你已登录</p>
      <p className="text-sm text-muted">
        {session.displayName ?? session.email ?? session.userId}
      </p>
      <Link
        href={callbackUrl}
        className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm bg-gold text-background border border-gold-dim"
      >
        返回
      </Link>
    </div>
  );
}

function LoginGateFallback() {
  return (
    <div className="w-full rounded-xl border border-border bg-surface/60 p-6 text-center">
      <p className="text-sm text-muted">正在检查登录状态…</p>
    </div>
  );
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <div className="flex flex-1 flex-col cyber-grid">
      <div className="safe-pad flex flex-1 flex-col items-center max-w-lg mx-auto w-full gap-6 pb-10 pt-4">
        <header className="w-full flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 首页
          </Link>
          <span className="text-sm tracking-[0.15em] text-gold">登录</span>
          <span className="w-10" aria-hidden />
        </header>

        <h1 className="sr-only">登录赛博命理</h1>

        <Suspense fallback={<LoginGateFallback />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

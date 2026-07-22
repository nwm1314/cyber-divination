import Link from "next/link";
import { LoginForm } from "@/components/auth";
import { getServerSession } from "@/lib/auth/get-session";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const callbackUrl =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/";
  const session = await getServerSession();

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

        {session.authenticated ? (
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
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
      </div>
    </div>
  );
}

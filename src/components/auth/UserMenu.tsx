"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppSession } from "@/lib/types/user";

type Props = {
  /** 服务端预取的会话 */
  initialSession?: AppSession | null;
  className?: string;
};

const anon: AppSession = {
  userId: null,
  authenticated: false,
  expires: null,
};

export function UserMenu({ initialSession = null, className = "" }: Props) {
  const router = useRouter();
  /** 登出后本地覆盖；服务端 session 更新后以服务端为准 */
  const [local, setLocal] = useState<AppSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [prevInitial, setPrevInitial] = useState(initialSession);

  if (initialSession !== prevInitial) {
    setPrevInitial(initialSession);
    setLocal(null);
  }

  const session = local ?? initialSession ?? anon;

  const onLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      const { setAccountPersistMode } = await import("@/lib/storage/mode");
      setAccountPersistMode(false);
      setLocal(anon);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!session.authenticated) {
    return (
      <div className={["flex items-center gap-2", className].join(" ")}>
        <span
          className="text-[10px] sm:text-xs text-amber-400/90 border border-amber-400/25 rounded-full px-2 py-0.5 hidden xs:inline sm:inline"
          title="游客结果仅本会话暂存，关浏览器即清空"
        >
          游客
        </span>
        <Link
          href="/privacy"
          className="text-xs sm:text-sm text-muted hover:text-cyan transition-colors hidden sm:inline"
        >
          隐私
        </Link>
        <Link
          href="/auth/login"
          className="text-xs sm:text-sm text-cyan hover:text-gold transition-colors border border-cyan/30 hover:border-gold/40 rounded-lg px-2.5 py-1.5"
        >
          登录保存
        </Link>
      </div>
    );
  }

  const label =
    session.displayName?.trim() ||
    session.email?.split("@")[0] ||
    "已登录";

  return (
    <div
      className={[
        "flex items-center gap-2 sm:gap-3 max-w-[min(100%,20rem)]",
        className,
      ].join(" ")}
    >
      <Link
        href="/account"
        className="text-xs sm:text-sm text-muted truncate hover:text-gold transition-colors"
        title={session.email ?? label}
      >
        <span className="text-gold/90">{label}</span>
        {session.email ? (
          <span className="hidden sm:inline text-muted">
            {" "}
            · {session.email}
          </span>
        ) : null}
      </Link>
      <Link
        href="/account"
        className="shrink-0 text-xs sm:text-sm text-muted hover:text-cyan border border-border hover:border-cyan/40 rounded-lg px-2.5 py-1.5 transition-colors"
      >
        账号
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onLogout()}
        className="shrink-0 text-xs sm:text-sm text-muted hover:text-danger border border-border hover:border-danger/40 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
      >
        {busy ? "…" : "登出"}
      </button>
    </div>
  );
}

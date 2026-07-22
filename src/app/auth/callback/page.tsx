"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

function CallbackInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(
    token ? null : "缺少登录令牌",
  );
  const [busy, setBusy] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/callback", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          callbackUrl?: string;
          error?: { message?: string };
        };
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error?.message ?? "登录链接无效或已过期");
            setBusy(false);
          }
          return;
        }
        const { enterAccountPersistMode } = await import("@/lib/storage/mode");
        enterAccountPersistMode();
        try {
          const { autoSyncAfterLogin } = await import("@/lib/storage/sync");
          await autoSyncAfterLogin();
        } catch {
          // 同步失败不阻断登录
        }
        const target =
          data.callbackUrl?.startsWith("/") &&
          !data.callbackUrl.startsWith("//")
            ? data.callbackUrl
            : "/";
        if (!cancelled) window.location.assign(target);
      } catch {
        if (!cancelled) {
          setError("网络异常，请稍后重试");
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center p-4">
      <Card
        title="登录验证"
        subtitle={busy ? "正在完成登录…" : error ? "登录失败" : "即将跳转"}
        glow="gold"
        className="w-full max-w-md"
      >
        {error ? (
          <div className="space-y-4">
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
            <Link href="/auth/login">
              <Button className="w-full">返回登录</Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">请稍候，正在写入会话…</p>
        )}
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 min-h-dvh items-center justify-center text-sm text-muted">
          加载中…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}

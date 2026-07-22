"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Field, inputClass } from "@/components/form/Field";

type Props = {
  /** 登录成功后跳转，默认 / */
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl = "/" }: Props) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isProd = process.env.NODE_ENV === "production";

  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";

  const afterSession = async () => {
    const { enterAccountPersistMode } = await import("@/lib/storage/mode");
    enterAccountPersistMode();
    try {
      const { autoSyncAfterLogin } = await import("@/lib/storage/sync");
      await autoSyncAfterLogin();
    } catch {
      // 同步失败不阻断
    }
    window.location.assign(safeCallback);
  };

  const onMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setDevLink(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          callbackUrl: safeCallback,
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        devLink?: string;
        emailed?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "发送失败");
        return;
      }
      setInfo(
        data.emailed
          ? "登录链接已发送，请查收邮件（15 分钟内有效）。"
          : data.message ?? "已生成登录链接。",
      );
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  const onDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "登录失败");
        return;
      }
      await afterSession();
    } catch {
      setError("网络异常，请稍后重试");
      setBusy(false);
    }
  };

  return (
    <Card
      title={isProd ? "邮箱登录" : "登录"}
      subtitle={
        isProd
          ? "输入邮箱获取登录链接（Magic Link）。游客模式结果仅本会话暂存。"
          : "开发环境可用 Magic Link 或快速登录；生产默认仅 Magic Link。"
      }
      glow="gold"
      className="w-full max-w-md"
    >
      <form
        onSubmit={(e) => void onMagic(e)}
        className="space-y-4"
      >
        <Field
          label="邮箱"
          required
          error={error && !email.trim() ? error : undefined}
        >
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            disabled={busy}
          />
        </Field>
        <Field label="显示名" hint="可选，默认取邮箱前缀">
          <input
            type="text"
            name="displayName"
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            placeholder="称呼"
            maxLength={64}
            disabled={busy}
          />
        </Field>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-cyan" role="status">
            {info}
          </p>
        ) : null}
        {devLink ? (
          <p className="text-xs text-muted break-all">
            开发链接：{" "}
            <a href={devLink} className="text-gold underline">
              点此完成登录
            </a>
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button type="submit" disabled={busy} className="w-full sm:flex-1">
            {busy ? "处理中…" : "发送登录链接"}
          </Button>
          {!isProd ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              className="w-full sm:flex-1"
              onClick={(e) => void onDevLogin(e as unknown as React.FormEvent)}
            >
              开发快速登录
            </Button>
          ) : null}
          <Link
            href="/chart/new"
            className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm border border-border text-muted hover:text-foreground hover:border-gold/40 transition-all w-full sm:w-auto"
          >
            游客模式继续
          </Link>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          登录后将自动尝试同步本机八字/紫微/六爻到云端（可稍后在档案页重试）。
        </p>
      </form>
    </Card>
  );
}

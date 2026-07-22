"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { isAccountPersistMode } from "@/lib/storage/mode";

const empty = () => () => {};

/**
 * 游客模式提示条：结果仅本会话暂存
 */
export function GuestBanner({ className = "" }: { className?: string }) {
  const mounted = useSyncExternalStore(empty, () => true, () => false);
  const isAccount = useSyncExternalStore(
    empty,
    () => isAccountPersistMode(),
    () => false,
  );

  if (!mounted || isAccount) return null;

  return (
    <div
      className={[
        "rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-100/90 leading-relaxed",
        className,
      ].join(" ")}
      role="status"
    >
      <strong className="text-amber-300 font-medium">游客模式</strong>
      ：排盘与报告仅在本浏览器会话暂存，关闭浏览器后清空。
      <Link
        href="/auth/login"
        className="ml-1 text-cyan hover:text-gold underline-offset-2 hover:underline"
      >
        登录后可长期保存与分享
      </Link>
    </div>
  );
}

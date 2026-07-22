"use client";

import { useEffect, useRef } from "react";
import type { AppSession } from "@/lib/types/user";
import {
  enterAccountPersistMode,
  isAccountPersistMode,
  setAccountPersistMode,
} from "@/lib/storage/mode";

type Props = {
  session: AppSession | null;
};

/**
 * 将服务端会话同步到客户端持久化模式：
 * 已登录 → 提升游客 session 数据后写 localStorage；
 * 未登录 → sessionStorage（游客）
 */
export function AuthModeSync({ session }: Props) {
  const prevAuth = useRef<boolean | null>(null);

  useEffect(() => {
    const authed = Boolean(session?.authenticated);
    if (authed) {
      // 已是账号模式则只保证 flag；否则提升游客盘再切模式
      if (!isAccountPersistMode()) {
        enterAccountPersistMode();
      } else {
        setAccountPersistMode(true);
      }
    } else {
      setAccountPersistMode(false);
    }
    prevAuth.current = authed;
  }, [session?.authenticated]);

  return null;
}

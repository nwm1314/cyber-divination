"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center safe-pad">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-bold text-gold">出了点问题</h1>
        <p className="text-sm text-muted leading-relaxed">
          页面渲染异常，可重试或返回首页。数据保存在本机浏览器，通常不会丢失。
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Button onClick={reset}>重试</Button>
          <Link href="/">
            <Button variant="secondary">首页</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

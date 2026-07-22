"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getLiuyaoChart } from "@/lib/storage";
import { Button } from "@/components/ui";
import { ChartResult } from "@/components/liuyao";

export default function LiuyaoChartPage() {
  const params = useParams();
  const chartId = params?.id as string;
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [tick, setTick] = useState(0);

  const chart = useMemo(() => {
    void tick;
    if (!mounted || !chartId) return null;
    return getLiuyaoChart(chartId);
  }, [chartId, tick, mounted]);

  if (!chartId) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-muted">缺少问卦 ID</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">加载卦象中…</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">未找到本地问卦记录，请先起卦。</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/liuyao/new">
              <Button>去起卦</Button>
            </Link>
            <Link href="/liuyao">
              <Button variant="secondary">问卦历史</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">回首页</Button>
            </Link>
            <Button variant="ghost" onClick={() => setTick((t) => t + 1)}>
              重新加载
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-lg sm:max-w-2xl mx-auto w-full gap-4 pb-8">
        <header className="flex items-center flex-wrap gap-3 pt-2">
          <Link
            href="/liuyao"
            className="text-xs text-muted hover:text-gold transition-colors"
          >
            ← 历史
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide flex-1 text-center sm:text-left">
            卦象结果
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/liuyao/new"
              className="text-xs text-muted hover:text-gold transition-colors"
            >
              再起一卦
            </Link>
            <Link
              href="/"
              className="text-xs text-muted hover:text-cyan transition-colors"
            >
              首页
            </Link>
          </div>
        </header>

        <ChartResult chart={chart} />

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/liuyao/${chartId}/reading`} className="flex-1">
            <Button className="w-full">查看解卦报告</Button>
          </Link>
          <Link href="/liuyao/new" className="flex-1">
            <Button className="w-full" variant="secondary">
              再问一事
            </Button>
          </Link>
          <Link href="/liuyao" className="flex-1">
            <Button className="w-full" variant="ghost">
              问卦历史
            </Button>
          </Link>
        </div>
        <p className="text-[10px] text-muted text-center leading-relaxed">
          解卦支持规则模板与 LLM 切换；无 Key 时自动回落模板。一事一问，仅供参考。
        </p>
      </div>
    </div>
  );
}

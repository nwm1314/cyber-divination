"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getZiweiChart } from "@/lib/storage";
import { Button, Card } from "@/components/ui";
import { TrustPanel } from "@/components/reading";
import { YunStrip, ZiweiChartView } from "@/components/ziwei";

export default function ZiweiChartPage() {
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
    if (!mounted) return null;
    return getZiweiChart(chartId);
  }, [chartId, tick, mounted]);

  if (!chartId) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-muted">缺少命盘 ID</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">加载紫微盘中…</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">
            未找到本地紫微盘，请先完成信息采集与排盘。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/ziwei/new">
              <Button>新建紫微盘</Button>
            </Link>
            <Link href="/ziwei">
              <Button variant="secondary">紫微列表</Button>
            </Link>
            <Button variant="ghost" onClick={() => setTick((t) => t + 1)}>
              重新加载
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const mingPalace = chart.palaces.find((p) => p.name === "命宫");

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-3xl mx-auto w-full gap-4 sm:gap-6 pb-8">
        <header className="flex items-center flex-wrap gap-3 pt-2">
          <Link
            href="/ziwei"
            className="text-xs text-muted hover:text-gold transition-colors"
          >
            ← 紫微列表
          </Link>
          <h1 className="text-lg font-bold tracking-wider text-gold">
            紫微命盘
            {chart.name ? (
              <span className="text-sm font-normal text-muted ml-2">
                {chart.name}
              </span>
            ) : null}
          </h1>
          {chart.wuxingJu ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan/30 bg-cyan/10 text-cyan">
              {chart.wuxingJu}
            </span>
          ) : null}
          {mingPalace ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-gold/30 bg-gold/10 text-gold">
              命宫·{mingPalace.stem}
              {mingPalace.branch}
            </span>
          ) : null}
        </header>

        <Card glow="cyan" className="!py-3 !px-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-muted">
            <span>
              身宫{" "}
              <strong className="text-foreground font-medium">
                {chart.shenGong}
              </strong>
            </span>
            {chart.mingZhu ? (
              <span>
                命主{" "}
                <strong className="text-gold font-medium">{chart.mingZhu}</strong>
              </span>
            ) : null}
            {chart.shenZhu ? (
              <span>
                身主{" "}
                <strong className="text-cyan font-medium">{chart.shenZhu}</strong>
              </span>
            ) : null}
            <span className="text-muted/70">
              {chart.meta.skillRef} · v{chart.meta.engineVersion}
            </span>
          </div>
        </Card>

        <ZiweiChartView chart={chart} />

        <YunStrip chart={chart} />

        <TrustPanel
          viewMode="pro"
          school={chart.meta?.school}
          engineVersion={chart.meta?.engineVersion}
          skillRef={chart.meta?.skillRef}
          warnings={chart.warnings}
          methodNote="紫微主盘为三合安星；未知时辰时请查看 hourCandidates 警告。"
        />

        <Card title="下一步">
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href={`/ziwei/${chartId}/reading`} className="flex-1">
              <Button className="w-full">查看解读报告</Button>
            </Link>
            <Link href="/ziwei/new" className="flex-1">
              <Button variant="secondary" className="w-full">
                再建一盘
              </Button>
            </Link>
            <Link href="/chart/new" className="flex-1">
              <Button variant="ghost" className="w-full">
                去排八字
              </Button>
            </Link>
          </div>
          <p className="text-[10px] text-muted mt-3 leading-relaxed">
            报告支持规则模板与 LLM 切换；无 Key 时自动回落模板。解读页可生成脱敏只读分享链接（T108）。
          </p>
        </Card>
      </div>
    </div>
  );
}

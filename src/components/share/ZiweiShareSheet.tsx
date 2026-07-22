"use client";

import { useState, useCallback, useMemo } from "react";
import type { ZiweiChart, ZiweiReadingReport } from "@/lib/types";
import {
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
} from "@/lib/share/extract-motto";
import { ZiweiShareCard } from "./ZiweiShareCard";
import { ExportBar } from "./ExportBar";
import { downloadGenericCardPng } from "@/lib/export/reportPdf";

type Props = {
  chart: ZiweiChart;
  report: ZiweiReadingReport;
  chartName: string;
};

function maskDisplayName(name: string): string {
  if (!name) return "紫微分享";
  if (name.length === 1) return "*";
  return name[0] + "*".repeat(Math.min(Math.max(name.length - 1, 1), 4));
}

export function ZiweiShareSheet({ chart, report, chartName }: Props) {
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [maskName, setMaskName] = useState(true);

  const advice = extractShareMottoFromSections(report.sections, {
    maxLen: 60,
    fallback: MOTTO_FALLBACK.ziwei,
    preferKeys: ["advice"],
  });

  const displayName = maskName
    ? maskDisplayName(chartName)
    : chartName || "紫微分享";

  const mingStars = useMemo(
    () =>
      chart.majorStars?.["命宫"] ??
      chart.majorStars?.[chart.mingGong] ??
      chart.palaces
        .find((p) => p.name === "命宫")
        ?.stars.filter((s) => !s.category || s.category === "major")
        .map((s) => s.name)
        .slice(0, 6),
    [chart.majorStars, chart.mingGong, chart.palaces],
  );

  const summary = useMemo(
    () => ({
      mingGong: String(chart.mingGong),
      shenGong: String(chart.shenGong),
      wuxingJu: chart.wuxingJu,
      mingZhu: chart.mingZhu,
      shenZhu: chart.shenZhu,
      mingStars,
    }),
    [
      chart.mingGong,
      chart.shenGong,
      chart.wuxingJu,
      chart.mingZhu,
      chart.shenZhu,
      mingStars,
    ],
  );

  const sections = useMemo(
    () =>
      report.sections.map((s) => ({
        title: s.title,
        body: s.body,
      })),
    [report.sections],
  );

  const handleGenerate = useCallback(async () => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ziwei",
          chart,
          report,
          chartName,
          maskName,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "分享生成失败");
      }
      setShareUrl(json.data.url as string);
    } finally {
      setShareLoading(false);
    }
  }, [chart, report, chartName, maskName]);

  const handleExportPng = useCallback(async () => {
    const lines = [
      `命宫 ${summary.mingGong} · 身宫 ${summary.shenGong}`,
      summary.wuxingJu ? `五行局 ${summary.wuxingJu}` : "",
      mingStars?.length ? `命宫主星 ${mingStars.join("、")}` : "",
      advice,
    ].filter(Boolean);
    await downloadGenericCardPng({
      title: displayName,
      brand: "赛博紫微 · 命盘分享",
      lines,
      footer: shareUrl ?? "排盘引擎不经 LLM · 解读可为模板/LLM · 仅供参考",
      filename: `ziwei-card-${Date.now()}`,
    });
  }, [summary, mingStars, advice, displayName, shareUrl]);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          className="accent-cyan"
          checked={maskName}
          onChange={(e) => setMaskName(e.target.checked)}
        />
        分享/导出时姓名脱敏（默认开启）
      </label>

      <ExportBar
        reportTitle={
          chartName ? `紫微解读 · ${displayName}` : "紫微解读报告"
        }
        reportSubtitle={`命宫 ${summary.mingGong} · 身宫 ${summary.shenGong}`}
        sections={sections}
        disclaimer={report.disclaimer}
        onExportPng={handleExportPng}
        onShare={handleGenerate}
        shareUrl={shareUrl}
        shareLoading={shareLoading}
      />

      <div className="max-w-md">
        <ZiweiShareCard
          summary={summary}
          advice={advice}
          chartName={displayName}
        />
      </div>
    </div>
  );
}

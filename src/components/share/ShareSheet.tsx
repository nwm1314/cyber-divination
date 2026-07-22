"use client";

import { useState, useCallback, useMemo } from "react";
import type { BaziChart, ReadingReport } from "@/lib/types";
import {
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
} from "@/lib/share/extract-motto";
import { ShareCard } from "./ShareCard";
import { downloadShareCardImage } from "./exportShareImage";
import { ExportBar } from "./ExportBar";

type Props = {
  chart: BaziChart;
  report: ReadingReport;
  chartName: string;
};

export function ShareSheet({ chart, report, chartName }: Props) {
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [maskName, setMaskName] = useState(true);

  const advice = extractShareMottoFromSections(report.sections, {
    maxLen: 60,
    fallback: MOTTO_FALLBACK.bazi,
    preferKeys: ["advice"],
  });

  const displayName = maskName
    ? chartName
      ? chartName[0] +
        "*".repeat(Math.min(Math.max(chartName.length - 1, 1), 4))
      : "命盘分享"
    : chartName || "命盘分享";

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
        body: JSON.stringify({ chart, report, chartName, maskName }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "分享生成失败");
      }
      setShareUrl(json.data.url);
    } finally {
      setShareLoading(false);
    }
  }, [chart, report, chartName, maskName]);

  const handleExportImage = useCallback(async () => {
    await downloadShareCardImage({
      pillars: chart.pillars,
      dayMaster: chart.dayMaster,
      advice,
      chartName: displayName,
      footer: shareUrl ?? "排盘引擎不经 LLM · 解读可为模板/LLM · 仅供参考",
    });
  }, [chart.pillars, chart.dayMaster, advice, displayName, shareUrl]);

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
          chartName ? `八字解读 · ${displayName}` : "八字解读报告"
        }
        reportSubtitle={`日主 ${chart.dayMaster}`}
        sections={sections}
        disclaimer={report.disclaimer}
        onExportPng={handleExportImage}
        onShare={handleGenerate}
        shareUrl={shareUrl}
        shareLoading={shareLoading}
        loginHref="/auth/login?callbackUrl=/charts"
      />

      <div className="max-w-md">
        <ShareCard
          pillars={chart.pillars}
          dayMaster={chart.dayMaster}
          advice={advice}
          chartName={displayName}
        />
      </div>
    </div>
  );
}

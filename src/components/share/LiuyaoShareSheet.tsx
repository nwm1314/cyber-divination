"use client";

import { useState, useCallback, useMemo } from "react";
import type { LiuyaoChart, LiuyaoReadingReport } from "@/lib/types";
import {
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
} from "@/lib/share/extract-motto";
import { ExportBar } from "./ExportBar";
import { downloadGenericCardPng } from "@/lib/export/reportPdf";
import { Card } from "@/components/ui";

type Props = {
  chart: LiuyaoChart;
  report: LiuyaoReadingReport;
};

export function LiuyaoShareSheet({ chart, report }: Props) {
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [maskQuestion, setMaskQuestion] = useState(true);

  const advice = extractShareMottoFromSections(report.sections, {
    maxLen: 60,
    fallback: MOTTO_FALLBACK.liuyao,
    preferKeys: ["advice", "judgment"],
  });

  const qDisplay = maskQuestion
    ? chart.question
      ? chart.question[0] + "***"
      : "一事一问"
    : chart.question;

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
          kind: "liuyao",
          chart,
          report,
          chartName: chart.question.slice(0, 24) || "六爻分享",
          maskName: maskQuestion,
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
  }, [chart, report, maskQuestion]);

  const handleExportPng = useCallback(async () => {
    const lines = [
      `所问：${qDisplay}`,
      `本卦 ${chart.benGua.name}`,
      chart.bianGua ? `变卦 ${chart.bianGua.name}` : "无变卦",
      chart.yongShen ? `用神 ${chart.yongShen}` : "",
      advice,
    ].filter(Boolean);
    await downloadGenericCardPng({
      title: "六爻解卦",
      brand: "赛博六爻 · 一事一问",
      lines,
      footer: shareUrl ?? "装卦引擎不经 LLM · 解卦可为模板/LLM · 仅供参考",
      filename: `liuyao-card-${Date.now()}`,
    });
  }, [qDisplay, chart, advice, shareUrl]);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          className="accent-cyan"
          checked={maskQuestion}
          onChange={(e) => setMaskQuestion(e.target.checked)}
        />
        分享/导出时事项脱敏（默认开启）
      </label>

      <ExportBar
        reportTitle={`六爻解卦 · ${chart.benGua.name}`}
        reportSubtitle={qDisplay}
        sections={sections}
        disclaimer={report.disclaimer}
        onExportPng={handleExportPng}
        onShare={handleGenerate}
        shareUrl={shareUrl}
        shareLoading={shareLoading}
      />

      <Card title="分享预览" subtitle="脱敏摘要">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted">所问</dt>
            <dd>{qDisplay}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">本卦</dt>
            <dd className="text-gold">{chart.benGua.name}</dd>
          </div>
          {chart.bianGua && (
            <div>
              <dt className="text-xs text-muted">变卦</dt>
              <dd className="text-cyan">{chart.bianGua.name}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-xs text-muted">签语</dt>
            <dd className="text-foreground/90">{advice}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

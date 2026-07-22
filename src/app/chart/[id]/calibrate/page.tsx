"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { BaziChart } from "@/lib/types";
import {
  getChart,
  getCalibration,
  getProfile,
  saveCalibration,
} from "@/lib/storage";
import { renderTemplateReading } from "@/lib/reading";
import {
  applyCalibrationToReport,
  computeCalibrationSummary,
  type CalibrationData,
} from "@/lib/reading/calibrate";
import { CalibrateBox } from "@/components/reading";
import { Button, Card } from "@/components/ui";

export default function CalibratePage() {
  const params = useParams();
  const chartId = (params?.id as string) ?? "";
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [calibrationOverride, setCalibrationOverride] =
    useState<CalibrationData | null | undefined>(undefined);

  const storedCalibration = useMemo(() => {
    if (!mounted || !chartId) return null;
    return getCalibration(chartId);
  }, [mounted, chartId]);

  const calibration =
    calibrationOverride === undefined ? storedCalibration : calibrationOverride;

  const chart: BaziChart | null = useMemo(() => {
    if (!mounted || !chartId) return null;
    return getChart(chartId);
  }, [mounted, chartId]);

  const profile = useMemo(() => {
    if (!mounted || !chartId) return null;
    return getProfile(chartId);
  }, [mounted, chartId]);

  const report = useMemo(() => {
    if (!chart) return null;
    return renderTemplateReading(chart, {
      viewMode: "plain",
      chartId,
      formerName: profile?.formerName,
      renameYear: profile?.renameYear,
      gender: profile?.gender,
    });
  }, [
    chart,
    chartId,
    profile?.formerName,
    profile?.renameYear,
    profile?.gender,
  ]);

  const summary =
    report && calibration
      ? computeCalibrationSummary(report, calibration)
      : null;

  const adjusted =
    report && summary ? applyCalibrationToReport(report, summary) : report;

  const handleCalibrated = useCallback((data: CalibrationData) => {
    saveCalibration(data);
    setCalibrationOverride(data);
  }, []);

  if (!chartId) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-dvh cyber-grid">
        <p className="text-muted">缺少命盘 ID</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-dvh cyber-grid">
        <p className="text-sm text-muted">加载中…</p>
      </div>
    );
  }

  if (!chart || !report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-dvh cyber-grid gap-4">
        <p className="text-muted">未找到命盘，请先排盘。</p>
        <Link href="/chart/new">
          <Button>新建命盘</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href={`/chart/${chartId}/reading`}
            className="text-sm text-muted hover:text-cyan"
          >
            ← 解读报告
          </Link>
          <h1 className="text-base font-medium text-gold">经历反馈</h1>
          <Link href={`/chart/${chartId}`}>
            <Button size="sm" variant="ghost">
              命盘
            </Button>
          </Link>
        </header>

        <p className="text-sm text-muted leading-relaxed">
          回忆已发生时段是否与报告叙述相符。反馈只调整阅读文案侧重，不重算四柱、不改用神/格局规则，也不提高命盘「准确率」。敏感备注默认不外发。
        </p>

        {summary?.emphasisNote ? (
          <Card glow="cyan" title="当前阅读侧重">
            <p className="text-sm leading-relaxed">{summary.emphasisNote}</p>
            {summary.policyNote ? (
              <p className="text-xs text-muted mt-2 leading-relaxed">
                {summary.policyNote}
              </p>
            ) : null}
          </Card>
        ) : null}

        <CalibrateBox
          prompts={report.calibratePrompts}
          chartId={chartId}
          initialAnswers={calibration?.answers}
          onCalibrated={handleCalibrated}
        />

        {adjusted ? (
          <Card title="校准后·建议章摘要" glow="gold">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {adjusted.sections.find((s) => s.key === "advice")?.body ?? "—"}
            </p>
          </Card>
        ) : null}

        <Link href={`/chart/${chartId}/reading`}>
          <Button className="w-full">返回完整解读</Button>
        </Link>
      </div>
    </div>
  );
}

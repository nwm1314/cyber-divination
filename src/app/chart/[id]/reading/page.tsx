"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useParams } from "next/navigation";
import type {
  BaziChart,
  ReadingReport,
  ReadingMode,
  ViewMode,
} from "@/lib/types";
import {
  getChart,
  getProfile,
  getCalibration,
  saveCalibration,
  saveReport,
} from "@/lib/storage";
import { getPrefs } from "@/lib/prefs";
import { renderTemplateReading } from "@/lib/reading";
import {
  computeCalibrationSummary,
  applyCalibrationToReport,
} from "@/lib/reading/calibrate";
import type { CalibrationData } from "@/lib/reading/calibrate";
import {
  SectionCard,
  ReportHeader,
  CalibrateBox,
  DisclaimerFooter,
  TrustPanel,
} from "@/components/reading";
import { ShareSheet } from "@/components/share";
import { GuestBanner } from "@/components/GuestBanner";
import { Card, Button } from "@/components/ui";
import Link from "next/link";

function useDefaultViewMode(): ViewMode {
  return useSyncExternalStore(
    () => () => {},
    () => getPrefs().defaultViewMode,
    () => "plain" as ViewMode,
  );
}

function loadStored(chartId: string): {
  chart: BaziChart | null;
  chartName: string;
  formerName?: string;
  renameYear?: number | "unknown";
  gender?: "male" | "female";
  calibration: CalibrationData | null;
} {
  if (typeof window === "undefined") {
    return { chart: null, chartName: "", calibration: null };
  }
  const profile = getProfile(chartId);
  return {
    chart: getChart(chartId),
    chartName: profile?.name ?? "",
    formerName: profile?.formerName,
    renameYear: profile?.renameYear,
    gender: profile?.gender,
    calibration: getCalibration(chartId),
  };
}

export default function ReadingPage() {
  const params = useParams();
  const chartId = (params?.id as string) ?? "";

  const stored = useMemo(() => loadStored(chartId), [chartId]);
  const chart = stored.chart;
  const chartName = stored.chartName;

  const [mode, setMode] = useState<ReadingMode>("template");
  const prefView = useDefaultViewMode();
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const viewMode = viewOverride ?? prefView;
  const [llmReport, setLlmReport] = useState<ReadingReport | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null=探测中；false=未配置 LLM */
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData | null>(
    stored.calibration,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/reading/status");
        const json = (await res.json()) as {
          data?: { llmConfigured?: boolean };
        };
        if (!cancelled) {
          setLlmConfigured(Boolean(json.data?.llmConfigured));
        }
      } catch {
        if (!cancelled) setLlmConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const templateReport = useMemo(() => {
    if (!chart) return null;
    try {
      return renderTemplateReading(chart, {
        viewMode,
        chartId,
        formerName: stored.formerName,
        renameYear: stored.renameYear,
        gender: stored.gender,
      });
    } catch {
      return null;
    }
  }, [
    chart,
    chartId,
    viewMode,
    stored.formerName,
    stored.renameYear,
    stored.gender,
  ]);

  const baseReport: ReadingReport | null =
    mode === "template" ? templateReport : llmReport;

  const calibrationSummary =
    baseReport && calibration
      ? computeCalibrationSummary(baseReport, calibration)
      : null;

  const report: ReadingReport | null =
    baseReport && calibrationSummary
      ? applyCalibrationToReport(baseReport, calibrationSummary)
      : baseReport;

  const fetchLlm = useCallback(
    async (overrideViewMode?: ViewMode) => {
      if (!chart) return;
      const vm = overrideViewMode ?? viewMode;
      setLlmLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chart,
            viewMode: vm,
            gender: stored.gender,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? "LLM 解读服务不可用");
        }
        const data = json.data as ReadingReport;
        // 服务端已可能 fallback:true（无 Key 或调用失败）
        setLlmReport(data);
        saveReport(data);
      } catch {
        if (templateReport) {
          const fallback: ReadingReport = {
            ...templateReport,
            mode: "llm",
            viewMode: vm,
            fallback: true,
            fallbackReason:
              "请求解读接口失败，已回落规则模板。请检查网络或服务端日志。",
          };
          setLlmReport(fallback);
          saveReport(fallback);
        } else {
          setError("解读失败");
        }
      } finally {
        setLlmLoading(false);
      }
    },
    [chart, templateReport, viewMode, stored.gender],
  );

  const handleModeChange = useCallback(
    (newMode: ReadingMode) => {
      if (newMode === "llm" && llmConfigured !== true) return;
      setMode(newMode);
      setError(null);
      if (newMode === "llm") {
        // 已有同 viewMode 缓存则复用
        if (llmReport && llmReport.viewMode === viewMode) return;
        void fetchLlm();
      }
    },
    [fetchLlm, llmReport, viewMode, llmConfigured],
  );

  const handleViewModeChange = useCallback(
    (vm: ViewMode) => {
      setViewOverride(vm);
      if (mode === "llm") {
        setLlmReport(null);
        void fetchLlm(vm);
      }
    },
    [mode, fetchLlm],
  );

  const handleCalibrated = useCallback((data: CalibrationData) => {
    saveCalibration(data);
    setCalibration(data);
  }, []);

  if (!chartId) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-muted">缺少命盘 ID</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">未找到命盘数据，请先完成排盘。</p>
          <Link href="/chart/new">
            <Button>新建命盘</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (templateReport === null && !report) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-danger">{error ?? "模板渲染失败"}</p>
      </div>
    );
  }

  const sections = report?.sections ?? [];
  // 严格按 skill 第三阶段顺序：…流年 → 校准 → 建议
  const loading = mode === "llm" && llmLoading && !report;

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-6xl mx-auto w-full gap-4 sm:gap-6 pb-8">
        <ReportHeader
          chartId={chartId}
          mode={mode}
          fallback={report?.fallback}
          fallbackReason={report?.fallbackReason}
          onModeChange={handleModeChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          llmConfigured={llmConfigured}
        />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan/50 border-t-cyan rounded-full animate-spin" />
              <span className="text-sm text-muted">正在调用 LLM 生成解读...</span>
            </div>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-4 sm:space-y-5">
            <GuestBanner />
            <ShareSheet chart={chart} report={report} chartName={chartName} />

            <div className="flex flex-wrap gap-2">
              <Link href={`/chart/${chartId}/calibrate`}>
                <Button size="sm" variant="secondary">
                  独立校准页
                </Button>
              </Link>
            </div>

            <TrustPanel
              viewMode={viewMode}
              school={report.school ?? chart.meta?.school}
              engineVersion={report.engineVersion ?? chart.meta?.engineVersion}
              skillRef={chart.meta?.skillRef}
              warnings={report.warnings ?? chart.warnings}
              evidence={report.evidence ?? chart.evidence}
              methodNote="八字：调候/扶抑等规则由引擎生成 evidence，LLM 不得发明 ruleId。"
            />

            {calibrationSummary?.emphasisNote && (
              <Card glow="cyan" title="经历反馈">
                <p className="text-sm leading-relaxed">
                  {calibrationSummary.emphasisNote}
                </p>
                {calibrationSummary.policyNote ? (
                  <p className="text-xs text-muted mt-2 leading-relaxed">
                    {calibrationSummary.policyNote}
                  </p>
                ) : null}
              </Card>
            )}

            {sections.map((section, i) => {
              const tag = calibrationSummary?.sectionTags[section.key];
              const mark =
                tag === "accurate"
                  ? " ✓"
                  : tag === "partial"
                    ? " ~"
                    : tag === "inaccurate"
                      ? " ✗"
                      : "";
              const adjustedTitle = tag
                ? `${section.title}${mark}`
                : section.title;
              return (
                <div key={`${section.key}-${viewMode}`} className="space-y-3">
                  <SectionCard
                    section={{ ...section, title: adjustedTitle }}
                    index={i + 1}
                  />
                  {section.key === "calibrate" &&
                  report.calibratePrompts &&
                  report.calibratePrompts.length > 0 ? (
                    <CalibrateBox
                      key={chartId}
                      prompts={report.calibratePrompts}
                      chartId={chartId}
                      initialAnswers={calibration?.answers}
                      onCalibrated={handleCalibrated}
                    />
                  ) : null}
                </div>
              );
            })}

            <DisclaimerFooter text={report.disclaimer} />
          </div>
        )}
      </div>
    </div>
  );
}

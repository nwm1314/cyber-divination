"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  LiuyaoChart,
  LiuyaoReadingReport,
  ReadingMode,
  ViewMode,
} from "@/lib/types";
import { getLiuyaoChart } from "@/lib/storage";
import { getPrefs } from "@/lib/prefs";
import { renderLiuyaoTemplateReading } from "@/lib/reading/liuyao";
import {
  SectionCard,
  ReportHeader,
  DisclaimerFooter,
} from "@/components/reading";
import { Button } from "@/components/ui";
import { LiuyaoShareSheet } from "@/components/share";
import { GuestBanner } from "@/components/GuestBanner";

function useDefaultViewMode(): ViewMode {
  return useSyncExternalStore(
    () => () => {},
    () => getPrefs().defaultViewMode,
    () => "plain" as ViewMode,
  );
}

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function LiuyaoReadingPage() {
  const params = useParams();
  const chartId = (params?.id as string) ?? "";
  const mounted = useMounted();

  const chart: LiuyaoChart | null = useMemo(() => {
    if (!mounted || !chartId) return null;
    return getLiuyaoChart(chartId);
  }, [chartId, mounted]);

  const [mode, setMode] = useState<ReadingMode>("template");
  const prefView = useDefaultViewMode();
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const viewMode = viewOverride ?? prefView;
  const [llmReport, setLlmReport] = useState<LiuyaoReadingReport | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);

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
      return renderLiuyaoTemplateReading(chart, {
        viewMode,
        chartId,
      });
    } catch {
      return null;
    }
  }, [chart, chartId, viewMode]);

  const report: LiuyaoReadingReport | null =
    mode === "template" ? templateReport : llmReport;

  const fetchLlm = useCallback(
    async (overrideViewMode?: ViewMode) => {
      if (!chart) return;
      const vm = overrideViewMode ?? viewMode;
      setLlmLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/reading/liuyao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chart,
            viewMode: vm,
            mode: "llm",
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error?.message ?? "LLM 解读服务不可用");
        }
        const data = json.data as LiuyaoReadingReport;
        setLlmReport(data);
      } catch {
        if (templateReport) {
          const fallback: LiuyaoReadingReport = {
            ...templateReport,
            mode: "llm",
            viewMode: vm,
            fallback: true,
            fallbackReason:
              "请求解读接口失败，已回落规则模板。请检查网络或服务端日志。",
          };
          setLlmReport(fallback);
        } else {
          setError("解读失败");
        }
      } finally {
        setLlmLoading(false);
      }
    },
    [chart, templateReport, viewMode],
  );

  const handleModeChange = useCallback(
    (newMode: ReadingMode) => {
      if (newMode === "llm" && llmConfigured !== true) return;
      setMode(newMode);
      setError(null);
      if (newMode === "llm") {
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
        <p className="text-sm text-muted">加载解卦中…</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">未找到本地问卦记录，请先起卦。</p>
          <Link href="/liuyao/new">
            <Button>去起卦</Button>
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
  const loading = mode === "llm" && llmLoading && !report;
  const qShort =
    chart.question.length > 16
      ? `${chart.question.slice(0, 16)}…`
      : chart.question;

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
          backHref={`/liuyao/${chartId}`}
          title={qShort ? `解卦 · ${qShort}` : "六爻解卦报告"}
        />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan/50 border-t-cyan rounded-full animate-spin" />
              <span className="text-sm text-muted">
                正在调用 LLM 生成解卦…
              </span>
            </div>
          </div>
        )}

        {!loading && report && chart && (
          <div className="space-y-4 sm:space-y-5">
            <GuestBanner />
            <LiuyaoShareSheet chart={chart} report={report} />

            {sections.map((section, i) => (
              <SectionCard
                key={`${section.key}-${viewMode}`}
                section={section}
                index={i + 1}
              />
            ))}

            <DisclaimerFooter text={report.disclaimer} />
          </div>
        )}
      </div>
    </div>
  );
}

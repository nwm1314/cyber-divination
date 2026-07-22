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
  ReadingMode,
  ViewMode,
  ZiweiChart,
  ZiweiReadingReport,
} from "@/lib/types";
import { getZiweiChart } from "@/lib/storage";
import { getPrefs } from "@/lib/prefs";
import { renderZiweiTemplateReading } from "@/lib/reading/ziwei";
import {
  SectionCard,
  ReportHeader,
  DisclaimerFooter,
  TrustPanel,
} from "@/components/reading";
import { Button } from "@/components/ui";
import { ZiweiShareSheet } from "@/components/share";
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

export default function ZiweiReadingPage() {
  const params = useParams();
  const chartId = (params?.id as string) ?? "";
  const mounted = useMounted();

  const chart: ZiweiChart | null = useMemo(() => {
    if (!mounted || !chartId) return null;
    return getZiweiChart(chartId);
  }, [chartId, mounted]);

  const chartName = chart?.name?.trim() || "";

  const [mode, setMode] = useState<ReadingMode>("template");
  const prefView = useDefaultViewMode();
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const viewMode = viewOverride ?? prefView;
  const [llmReport, setLlmReport] = useState<ZiweiReadingReport | null>(null);
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
      return renderZiweiTemplateReading(chart, {
        viewMode,
        chartId,
      });
    } catch {
      return null;
    }
  }, [chart, chartId, viewMode]);

  const report: ZiweiReadingReport | null =
    mode === "template" ? templateReport : llmReport;

  const fetchLlm = useCallback(
    async (overrideViewMode?: ViewMode) => {
      if (!chart) return;
      const vm = overrideViewMode ?? viewMode;
      setLlmLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/reading/ziwei", {
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
        const data = json.data as ZiweiReadingReport;
        setLlmReport(data);
      } catch {
        if (templateReport) {
          const fallback: ZiweiReadingReport = {
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
        <p className="text-muted">缺少命盘 ID</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">加载报告中…</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">未找到紫微盘数据，请先完成排盘。</p>
          <Link href="/ziwei/new">
            <Button>新建紫微盘</Button>
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
          backHref={`/ziwei/${chartId}`}
          title={chartName ? `紫微解读 · ${chartName}` : "紫微解读报告"}
        />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan/50 border-t-cyan rounded-full animate-spin" />
              <span className="text-sm text-muted">
                正在调用 LLM 生成紫微解读...
              </span>
            </div>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-4 sm:space-y-5">
            <GuestBanner />
            <ZiweiShareSheet
              chart={chart}
              report={report}
              chartName={chartName}
            />

            <TrustPanel
              viewMode={viewMode}
              school={report.school ?? chart.meta?.school}
              engineVersion={report.engineVersion ?? chart.meta?.engineVersion}
              skillRef={chart.meta?.skillRef}
              warnings={report.warnings ?? chart.warnings}
              methodNote="紫微：流派/版本由引擎透传；解读不发明安星事实。"
            />

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

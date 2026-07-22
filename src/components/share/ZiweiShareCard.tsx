import type { ZiweiShareSummary } from "@/lib/types";

type Props = {
  summary: ZiweiShareSummary;
  advice: string;
  chartName: string;
};

export function ZiweiShareCard({ summary, advice, chartName }: Props) {
  const stars =
    summary.mingStars && summary.mingStars.length > 0
      ? summary.mingStars.join(" · ")
      : "—";

  return (
    <div className="rounded-xl bg-surface/90 backdrop-blur-sm border neon-border p-5 sm:p-6">
      <div className="text-center mb-4">
        <h2 className="text-base font-bold tracking-wider text-gold">
          {chartName}
        </h2>
        <p className="text-[10px] text-muted/50 mt-0.5">赛博紫微 · 命盘分享</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
          <p className="text-[10px] text-muted mb-1">命宫</p>
          <p className="font-medium text-gold">{summary.mingGong}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
          <p className="text-[10px] text-muted mb-1">身宫</p>
          <p className="font-medium text-cyan">{summary.shenGong}</p>
        </div>
        {summary.wuxingJu ? (
          <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
            <p className="text-[10px] text-muted mb-1">五行局</p>
            <p className="font-medium text-foreground">{summary.wuxingJu}</p>
          </div>
        ) : null}
        {summary.mingZhu || summary.shenZhu ? (
          <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
            <p className="text-[10px] text-muted mb-1">命主 / 身主</p>
            <p className="font-medium text-foreground">
              {[summary.mingZhu, summary.shenZhu].filter(Boolean).join(" / ") ||
                "—"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2">
        <p className="text-[10px] text-muted mb-1">命宫主星</p>
        <p className="text-sm text-foreground/90 tracking-wide">{stars}</p>
      </div>

      {advice ? (
        <div className="mt-5 pt-4 border-t border-border/40">
          <p className="text-xs font-medium text-gold mb-2 tracking-wide">
            签语
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">{advice}</p>
        </div>
      ) : null}
    </div>
  );
}

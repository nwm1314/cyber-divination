import type { BaziChart, StartAgeDetail } from "@/lib/types";

type Props = {
  dayun: BaziChart["dayun"];
  currentDayunIndex: number;
  startAgeDetail?: StartAgeDetail;
};

/** 文案：约 X 岁 Y 个月起运 */
export function formatStartAgeDetail(detail?: StartAgeDetail): string | null {
  if (!detail) return null;
  const { years, months } = detail;
  if (years <= 0 && months <= 0) return "约出生即起运";
  if (months > 0) return `约 ${years} 岁 ${months} 个月起运`;
  return `约 ${years} 岁起运`;
}

export function DayunTimeline({
  dayun,
  currentDayunIndex,
  startAgeDetail,
}: Props) {
  if (!dayun.length) return <p className="text-sm text-muted">暂无大运数据</p>;

  const startLabel = formatStartAgeDetail(startAgeDetail);
  const hasPre = dayun.some((d) => d.isPreDayun);

  return (
    <div className="space-y-3">
      {startLabel && (
        <p className="text-xs text-muted">
          <span className="text-gold/90 font-medium">{startLabel}</span>
          {hasPre ? (
            <span className="ml-2 text-muted/70">起运前见「小运」步</span>
          ) : null}
        </p>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max">
          {dayun.map((step, i) => {
            const isCurrent =
              !step.isPreDayun && step.index === currentDayunIndex;
            const isPre = Boolean(step.isPreDayun);
            const isFirstFormal = !isPre && step.index === 0;
            return (
              <div
                key={`${step.index}-${step.stem}${step.branch}`}
                className="flex items-center"
              >
                <div
                  className={`flex flex-col items-center px-3 py-2 rounded-lg transition-all ${
                    isCurrent
                      ? "bg-gold/10 border border-gold/40 shadow-[0_0_16px_var(--gold-glow)]"
                      : isPre
                        ? "bg-surface/60 border border-border/30 border-dashed"
                        : "bg-surface border border-border/40"
                  }`}
                >
                  <span
                    className={`text-sm font-bold tracking-wider ${
                      isCurrent ? "text-gold" : "text-foreground"
                    }`}
                  >
                    {step.stem}
                    {step.branch}
                  </span>
                  <span className="text-[10px] text-muted mt-0.5">
                    {step.startAge}–{step.endAge}岁
                  </span>
                  <span className="text-[10px] text-muted/60">
                    {step.startYear}–{step.endYear}
                  </span>
                  {isFirstFormal && startLabel && (
                    <span className="text-[9px] text-gold/80 mt-0.5">
                      {startLabel.replace("起运", "起")}
                    </span>
                  )}
                  {isPre && (
                    <span className="text-[9px] text-muted font-semibold mt-1">
                      起运前·小运
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] text-gold font-semibold mt-1">
                      当前大运
                    </span>
                  )}
                </div>
                {i < dayun.length - 1 && (
                  <div className="w-4 h-px bg-border/60 mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

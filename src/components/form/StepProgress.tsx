export function StepProgress({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels?: string[];
}) {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div
      className="w-full space-y-2"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`步骤 ${current + 1} / ${total}${labels?.[current] ? `：${labels[current]}` : ""}`}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          步骤 {current + 1} / {total}
        </span>
        {labels?.[current] ? (
          <span className="text-cyan">{labels[current]}</span>
        ) : (
          <span className="text-muted/60">{pct}%</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-colors",
              i < current
                ? "bg-gold"
                : i === current
                  ? "bg-cyan"
                  : "bg-border",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

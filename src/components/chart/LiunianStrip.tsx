import type { BaziChart } from "@/lib/types";

type Props = {
  liunian: BaziChart["liunian"];
  /**
   * 高亮年。**必传**：不要在组件内回落到 `new Date()` ——
   * 那会在静态外壳预渲染时产出非确定性内容
   * （cacheComponents 下报 `next-prerender-current-time-client`）。
   * 调用方应在客户端挂载后再取"今年"并传入。
   */
  highlightYear?: number;
};

export function LiunianStrip({ liunian, highlightYear }: Props) {
  if (!liunian.length) return <p className="text-sm text-muted">暂无流年数据</p>;

  const hy = highlightYear;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-3 min-w-max">
        {liunian.map((item, i) => {
          const isCurrent = item.year === hy;
          return (
            <div key={`${item.year}-${i}`} className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                  isCurrent
                    ? "bg-cyan/10 border-cyan/40 shadow-[0_0_12px_var(--cyan-glow,rgba(0,255,255,0.2))]"
                    : "bg-surface border-border/40"
                }`}
              >
                <span className="text-xs text-muted font-medium">{item.year}</span>
                <span
                  className={`text-sm font-bold tracking-wider ${
                    isCurrent ? "text-cyan" : "text-cyan/80"
                  }`}
                >
                  {item.stem}
                  {item.branch}
                </span>
                <span className="text-[10px] text-muted">{item.age}岁</span>
                {isCurrent ? (
                  <span className="text-[9px] text-cyan font-semibold">当年</span>
                ) : null}
              </div>
              {i < liunian.length - 1 && (
                <span className="text-border/40 text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

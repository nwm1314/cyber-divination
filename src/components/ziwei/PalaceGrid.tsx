import type { ZiweiChart, ZiweiPalace, Dizhi } from "@/lib/types/ziwei";
import { PalaceCell } from "./PalaceCell";

/**
 * 地支固定方位（俯视方盘，北在下）：
 *   巳 午 未 申
 *   辰       酉
 *   卯       戌
 *   寅 丑 子 亥
 */
const BRANCH_GRID: Record<
  Dizhi,
  { row: number; col: number }
> = {
  巳: { row: 0, col: 0 },
  午: { row: 0, col: 1 },
  未: { row: 0, col: 2 },
  申: { row: 0, col: 3 },
  辰: { row: 1, col: 0 },
  酉: { row: 1, col: 3 },
  卯: { row: 2, col: 0 },
  戌: { row: 2, col: 3 },
  寅: { row: 3, col: 0 },
  丑: { row: 3, col: 1 },
  子: { row: 3, col: 2 },
  亥: { row: 3, col: 3 },
};

type Props = {
  chart: ZiweiChart;
};

function byBranch(palaces: ZiweiPalace[]): Map<Dizhi, ZiweiPalace> {
  const m = new Map<Dizhi, ZiweiPalace>();
  for (const p of palaces) m.set(p.branch, p);
  return m;
}

export function PalaceGrid({ chart }: Props) {
  const map = byBranch(chart.palaces);
  const ordered = (
    Object.entries(BRANCH_GRID) as [Dizhi, { row: number; col: number }][]
  ).map(([branch, pos]) => ({
    branch,
    pos,
    palace: map.get(branch),
  }));

  return (
    <div
      className="relative w-full max-w-2xl mx-auto aspect-square"
      role="img"
      aria-label="紫微十二宫命盘"
    >
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-px rounded-xl overflow-hidden border border-border neon-border bg-border/40">
        {ordered.map(({ branch, pos, palace }) => {
          if (!palace) {
            return (
              <div
                key={branch}
                className="bg-surface/60 p-2 text-[10px] text-muted"
                style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}
              >
                {branch}
              </div>
            );
          }
          return (
            <div
              key={branch}
              style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}
              className="min-h-0"
            >
              <PalaceCell
                palace={palace}
                isMing={palace.name === "命宫"}
                className="h-full"
              />
            </div>
          );
        })}

        {/* 中宫 2×2 */}
        <div
          className="flex flex-col items-center justify-center gap-1 sm:gap-1.5 p-2 sm:p-3 text-center bg-surface-elevated/95 border border-gold/20"
          style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}
        >
          <p className="text-[10px] sm:text-xs text-cyan tracking-widest">
            紫微斗数
          </p>
          {chart.name ? (
            <p className="text-sm sm:text-base font-semibold text-gold truncate max-w-full">
              {chart.name}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-muted">
            {chart.wuxingJu ? (
              <span className="text-cyan">{chart.wuxingJu}</span>
            ) : null}
            <span>
              身宫·
              <strong className="text-foreground font-medium">
                {chart.shenGong}
              </strong>
            </span>
          </div>
          {(chart.mingZhu || chart.shenZhu) && (
            <div className="flex flex-wrap justify-center gap-x-2 text-[9px] sm:text-[10px] text-muted/90">
              {chart.mingZhu ? <span>命主 {chart.mingZhu}</span> : null}
              {chart.shenZhu ? <span>身主 {chart.shenZhu}</span> : null}
            </div>
          )}
          <p className="text-[8px] sm:text-[9px] text-muted/60 mt-0.5">
            {chart.meta.school === "sanhe" ? "三合" : chart.meta.school} · v
            {chart.meta.engineVersion}
            {chart.meta.agePolicy === "xusui" ? " · 虚岁" : null}
          </p>
          {chart.warnings?.length ? (
            <p className="text-[8px] sm:text-[9px] text-danger/90 mt-0.5 max-w-[12rem] leading-snug">
              {chart.warnings[0]}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

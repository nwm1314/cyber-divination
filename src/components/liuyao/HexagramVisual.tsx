"use client";

import type { GuaRef, LiuyaoLine } from "@/lib/types/liuyao";
import { YaoLine } from "./YaoLine";

export type HexagramVisualProps = {
  title?: string;
  gua: GuaRef;
  lines: LiuyaoLine[];
  shiYao?: number;
  yingYao?: number;
  compact?: boolean;
  className?: string;
};

/**
 * 卦象可视化：上爻在上、初爻在下；展示本卦名与六爻线
 */
export function HexagramVisual({
  title,
  gua,
  lines,
  shiYao = 0,
  yingYao = 0,
  compact = false,
  className = "",
}: HexagramVisualProps) {
  // 展示自上而下：上爻 → 初爻
  const topDown = [...lines].sort((a, b) => b.yao - a.yao);

  return (
    <div
      className={[
        "rounded-xl border border-border bg-surface-elevated/60 neon-border",
        compact ? "p-3" : "p-4 sm:p-5",
        className,
      ].join(" ")}
    >
      {title ? (
        <p className="text-xs text-muted tracking-widest mb-2">{title}</p>
      ) : null}
      <div className="text-center mb-3 sm:mb-4 space-y-1">
        <h3
          className={[
            "font-semibold tracking-wide text-gold",
            compact ? "text-lg" : "text-xl sm:text-2xl",
          ].join(" ")}
        >
          {gua.name}
        </h3>
        <p className="text-xs text-muted">
          上{gua.upper} · 下{gua.lower}
        </p>
      </div>

      <div className="flex flex-col gap-0.5" aria-label={`${gua.name}六爻`}>
        {topDown.map((line) => {
          let highlight: "shi" | "ying" | null = null;
          if (shiYao > 0 && line.yao === shiYao) highlight = "shi";
          else if (yingYao > 0 && line.yao === yingYao) highlight = "ying";
          return (
            <YaoLine
              key={line.yao}
              value={line.value}
              position={line.yao}
              changing={line.changing}
              highlight={highlight}
              compact={compact}
            />
          );
        })}
      </div>

      {shiYao > 0 || yingYao > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3 justify-center text-[10px] text-muted">
          {shiYao > 0 ? (
            <span className="text-gold/80">世 · 第{shiYao}爻</span>
          ) : null}
          {yingYao > 0 ? (
            <span className="text-cyan/80">应 · 第{yingYao}爻</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

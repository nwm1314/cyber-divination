"use client";

import type { YaoValue } from "@/lib/types/liuyao";

const YAO_LABEL: Record<YaoValue, string> = {
  6: "老阴",
  7: "少阳",
  8: "少阴",
  9: "老阳",
};

const POS_LABEL = ["", "初", "二", "三", "四", "五", "上"] as const;

export type YaoLineProps = {
  value: YaoValue;
  /** 1–6，自下而上 */
  position: number;
  changing?: boolean;
  /** 是否高亮（世/应等） */
  highlight?: "shi" | "ying" | null;
  compact?: boolean;
  className?: string;
};

/** 单爻线：阳实阴虚，动爻标 ○ / × */
export function YaoLine({
  value,
  position,
  changing,
  highlight = null,
  compact = false,
  className = "",
}: YaoLineProps) {
  const isYang = value === 7 || value === 9;
  const isDong = changing ?? (value === 6 || value === 9);
  const mark = value === 9 ? "○" : value === 6 ? "×" : "";
  const posName = POS_LABEL[position] ?? String(position);
  const hiClass =
    highlight === "shi"
      ? "ring-1 ring-gold/50 bg-gold/5"
      : highlight === "ying"
        ? "ring-1 ring-cyan/50 bg-cyan/5"
        : "";

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg px-2",
        compact ? "py-1" : "py-1.5",
        hiClass,
        className,
      ].join(" ")}
      role="img"
      aria-label={`${posName}爻 ${YAO_LABEL[value]}${isDong ? " 动" : ""}`}
    >
      <span
        className={[
          "w-8 shrink-0 text-right tabular-nums",
          compact ? "text-[10px]" : "text-xs",
          "text-muted",
        ].join(" ")}
      >
        {posName}
      </span>

      <div className="flex flex-1 items-center justify-center gap-1 min-h-[1.25rem]">
        {isYang ? (
          <div
            className={[
              "w-full max-w-[10rem] rounded-sm",
              compact ? "h-1.5" : "h-2",
              isDong
                ? "bg-gold shadow-[0_0_10px_var(--gold-glow)]"
                : "bg-foreground/85",
            ].join(" ")}
          />
        ) : (
          <div className="flex w-full max-w-[10rem] items-center justify-between gap-2">
            <div
              className={[
                "flex-1 rounded-sm",
                compact ? "h-1.5" : "h-2",
                isDong
                  ? "bg-cyan shadow-[0_0_10px_var(--cyan-glow)]"
                  : "bg-foreground/85",
              ].join(" ")}
            />
            <div
              className={[
                "flex-1 rounded-sm",
                compact ? "h-1.5" : "h-2",
                isDong
                  ? "bg-cyan shadow-[0_0_10px_var(--cyan-glow)]"
                  : "bg-foreground/85",
              ].join(" ")}
            />
          </div>
        )}
      </div>

      <span
        className={[
          "w-10 shrink-0 text-center font-medium",
          compact ? "text-sm" : "text-base",
          isDong ? "text-gold" : "text-muted",
        ].join(" ")}
        aria-hidden
      >
        {mark || "\u00a0"}
      </span>

      {!compact ? (
        <span
          className={[
            "w-12 shrink-0 text-xs",
            isDong ? "text-gold" : "text-muted",
          ].join(" ")}
        >
          {YAO_LABEL[value]}
        </span>
      ) : null}
    </div>
  );
}

export { YAO_LABEL };

"use client";

import type { ZiweiChart } from "@/lib/types";

type Props = {
  chart: ZiweiChart;
};

function chip(text: string, active?: boolean) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-[11px] text-gold"
          : "inline-flex items-center rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted"
      }
    >
      {text}
    </span>
  );
}

/** 流月 / 流日运限条（T240） */
export function YunStrip({ chart }: Props) {
  const yue = chart.liuyue ?? [];
  const ri = chart.liuri ?? [];
  if (yue.length === 0 && ri.length === 0) return null;

  const midYue = yue[Math.floor(yue.length / 2)];
  const midRi = ri[Math.floor(ri.length / 2)];

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          流月
        </p>
        <div className="flex flex-wrap gap-2">
          {yue.map((n) =>
            chip(
              `${n.month} ${n.palace ?? ""}${n.stem ?? ""}${n.branch ?? ""}${
                n.sihuaOut?.length
                  ? ` 化${n.sihuaOut.map((x) => x.kind).join("")}`
                  : ""
              }`,
              n.month === midYue?.month,
            ),
          )}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          流日
        </p>
        <div className="flex flex-wrap gap-2">
          {ri.map((n) =>
            chip(
              `${n.date} ${n.palace ?? ""}${n.stem ?? ""}${n.branch ?? ""}${
                n.sihuaOut?.length
                  ? ` 化${n.sihuaOut.map((x) => x.kind).join("")}`
                  : ""
              }`,
              n.date === midRi?.date,
            ),
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted/80 leading-relaxed">
        流月/流日为运限叠盘摘要（月干/日干四化 + 支落宫），不写回本命星；仅供学习参考。
      </p>
    </div>
  );
}

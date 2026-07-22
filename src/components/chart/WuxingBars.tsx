import type { BaziChart } from "@/lib/types";
import {
  computeYongshen,
  WUXING_LABEL_ZH,
  type WuxingKey,
} from "@/lib/bazi/yongshen";
import { STEM_WUXING } from "@/lib/bazi/wuxing";
import { WuxingRadar } from "./WuxingRadar";

type Props = {
  scores: BaziChart["wuxingScores"];
  dayMaster: string;
  viewMode: "plain" | "pro";
  /** 可选：传入完整 chart 以统一喜用；否则仅展示分数 */
  chart?: BaziChart;
};

const WUXING = [
  { key: "wood" as const, label: "木", bar: "bg-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-400" },
  { key: "fire" as const, label: "火", bar: "bg-red-400", bg: "bg-red-400/10", text: "text-red-400" },
  { key: "earth" as const, label: "土", bar: "bg-amber-400", bg: "bg-amber-400/10", text: "text-amber-400" },
  { key: "metal" as const, label: "金", bar: "bg-zinc-200", bg: "bg-zinc-200/10", text: "text-zinc-200" },
  { key: "water" as const, label: "水", bar: "bg-cyan-400", bg: "bg-cyan-400/10", text: "text-cyan-400" },
];

export function WuxingBars({ scores, dayMaster, viewMode, chart }: Props) {
  const values = WUXING.map((w) => scores[w.key]);
  const maxScore = Math.max(...values, 1);

  const dmWx = (STEM_WUXING[dayMaster as keyof typeof STEM_WUXING] ??
    "earth") as WuxingKey;
  const dominant = WUXING.reduce((a, b) =>
    scores[a.key] > scores[b.key] ? a : b,
  );

  const yong = chart
    ? computeYongshen({ ...chart, wuxingScores: scores, dayMaster })
    : null;

  return (
    <div className="space-y-3">
      {viewMode === "plain" ? (
        <WuxingRadar scores={scores} />
      ) : null}

      <div
        className="space-y-2.5"
        role="list"
        aria-label="五行力量条"
      >
        {WUXING.map((w) => {
          const score = scores[w.key];
          const pct = Math.min((score / maxScore) * 100, 100);
          const isDominant = score === maxScore && score > 0;
          return (
            <div key={w.key} role="listitem">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-medium ${w.text}`}>{w.label}</span>
                <span className="text-muted font-mono" aria-label={`${w.label} ${score.toFixed(1)}`}>
                  {score.toFixed(1)}
                </span>
              </div>
              <div
                className={`h-2 rounded-full ${w.bg} overflow-hidden`}
                role="progressbar"
                aria-valuenow={Math.round(score * 10) / 10}
                aria-valuemin={0}
                aria-valuemax={Math.round(maxScore * 10) / 10}
                aria-label={`${w.label}力量`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${w.bar} ${
                    isDominant ? "shadow-[0_0_8px]" : ""
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {viewMode === "plain" && (
        <p className="text-xs text-muted mt-2 leading-relaxed">
          日主<strong className="text-gold">{dayMaster}</strong>五行属
          <strong>{WUXING_LABEL_ZH[dmWx]}</strong>，五行以
          <strong>{dominant.label}</strong>最旺。
          {yong ? (
            <>
              {" "}
              喜用：
              <strong className="text-cyan">{yong.plainLine}</strong>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

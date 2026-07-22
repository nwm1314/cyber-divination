import type { BaziChart } from "@/lib/types";

type Props = {
  scores: BaziChart["wuxingScores"];
  /** 可选尺寸，默认自适应容器 */
  size?: number;
};

const WUXING = [
  { key: "wood" as const, label: "木", color: "#34d399" },
  { key: "fire" as const, label: "火", color: "#f87171" },
  { key: "earth" as const, label: "土", color: "#fbbf24" },
  { key: "metal" as const, label: "金", color: "#e4e4e7" },
  { key: "water" as const, label: "水", color: "#22d3ee" },
];

const N = WUXING.length;
const CX = 100;
const CY = 100;
const R = 72;
const LEVELS = 4;

function polar(i: number, radius: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  };
}

function ringPath(radius: number) {
  return WUXING.map((_, i) => {
    const { x, y } = polar(i, radius);
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ") + " Z";
}

export function WuxingRadar({ scores, size = 220 }: Props) {
  const values = WUXING.map((w) => scores[w.key]);
  const maxScore = Math.max(...values, 1);
  const norms = values.map((v) => Math.min(v / maxScore, 1));

  const dataPath =
    norms
      .map((n, i) => {
        const { x, y } = polar(i, R * n);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  const summary = WUXING.map(
    (w) => `${w.label}${scores[w.key].toFixed(1)}`,
  ).join("，");

  return (
    <div
      className="flex flex-col items-center gap-2 w-full"
      role="img"
      aria-label={`五行雷达图：${summary}`}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="w-full max-w-[240px] h-auto mx-auto"
        aria-hidden
      >
        <defs>
          <radialGradient id="wuxing-radar-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.12" />
          </radialGradient>
          <filter id="wuxing-radar-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 网格环 */}
        {Array.from({ length: LEVELS }, (_, lv) => {
          const r = (R * (lv + 1)) / LEVELS;
          return (
            <path
              key={lv}
              d={ringPath(r)}
              fill="none"
              stroke="currentColor"
              strokeOpacity={lv === LEVELS - 1 ? 0.28 : 0.12}
              strokeWidth={lv === LEVELS - 1 ? 1 : 0.6}
              className="text-border"
            />
          );
        })}

        {/* 轴线 */}
        {WUXING.map((_, i) => {
          const { x, y } = polar(i, R);
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeWidth={0.6}
              className="text-border"
            />
          );
        })}

        {/* 数据区 */}
        <path
          d={dataPath}
          fill="url(#wuxing-radar-fill)"
          stroke="var(--cyan)"
          strokeWidth={1.4}
          strokeLinejoin="round"
          filter="url(#wuxing-radar-glow)"
        />

        {/* 顶点 */}
        {norms.map((n, i) => {
          const { x, y } = polar(i, R * n);
          const c = WUXING[i].color;
          return (
            <circle
              key={WUXING[i].key}
              cx={x}
              cy={y}
              r={3.2}
              fill={c}
              stroke="var(--background, #0a0a0c)"
              strokeWidth={1}
            />
          );
        })}

        {/* 标签 */}
        {WUXING.map((w, i) => {
          const { x, y } = polar(i, R + 16);
          return (
            <text
              key={w.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={w.color}
              fontSize={12}
              fontWeight={600}
            >
              {w.label}
            </text>
          );
        })}
      </svg>

      {/* 屏幕阅读器可读明细 */}
      <ul className="sr-only">
        {WUXING.map((w) => (
          <li key={w.key}>
            {w.label}：{scores[w.key].toFixed(1)}
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { BaziChart } from "@/lib/types";

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;
const ROW_LABELS = ["天干", "地支", "十神", "藏干"] as const;

const STEM_COLORS: Record<string, string> = {
  甲: "text-emerald-400", 乙: "text-emerald-300",
  丙: "text-red-400", 丁: "text-rose-300",
  戊: "text-amber-400", 己: "text-amber-300",
  庚: "text-zinc-200", 辛: "text-zinc-300",
  壬: "text-cyan-400", 癸: "text-cyan-300",
};

const BRANCH_COLORS: Record<string, string> = {
  子: "text-cyan-400", 丑: "text-amber-400",
  寅: "text-emerald-400", 卯: "text-emerald-300",
  辰: "text-amber-400", 巳: "text-red-400",
  午: "text-red-400", 未: "text-amber-400",
  申: "text-zinc-200", 酉: "text-zinc-300",
  戌: "text-amber-400", 亥: "text-cyan-300",
};

type Props = {
  pillars: BaziChart["pillars"];
  dayMaster: string;
};

export function BaziTable({ pillars, dayMaster }: Props) {
  const pillarData = [
    pillars.year,
    pillars.month,
    pillars.day,
    pillars.hour ?? null,
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr>
            <th className="p-2 w-10" />
            {PILLAR_LABELS.map((label, i) => (
              <th
                key={label}
                className={`p-2 text-sm font-semibold tracking-wider ${
                  i === 2 ? "text-gold" : "text-muted"
                }`}
              >
                {label}
                {i === 2 && (
                  <span className="block text-[10px] font-normal text-cyan mt-0.5">
                    日主·{dayMaster}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_LABELS.map((rowLabel, rowIndex) => (
            <tr key={rowLabel}>
              <td className="p-2 text-[11px] text-muted font-medium border-b border-border/40">
                {rowLabel}
              </td>
              {pillarData.map((pillar, colIndex) => {
                const isDay = colIndex === 2;
                const isEmpty = pillar === null;
                return (
                  <td
                    key={colIndex}
                    className={`p-2 border-b border-border/40 ${
                      isEmpty ? "text-muted" : ""
                    }`}
                  >
                    {isEmpty ? (
                      <span className="text-xs">未知</span>
                    ) : (
                      <span
                        className={`text-base sm:text-lg font-medium tracking-wider ${
                          rowIndex === 0
                            ? STEM_COLORS[pillar.stem] ?? "text-foreground"
                            : rowIndex === 1
                              ? BRANCH_COLORS[pillar.branch] ?? "text-foreground"
                              : rowIndex === 2
                                ? isDay
                                  ? "text-gold"
                                  : "text-foreground"
                                : "text-foreground/60"
                        }`}
                      >
                        {rowIndex === 0 && pillar.stem}
                        {rowIndex === 1 && pillar.branch}
                        {rowIndex === 2 && (isDay ? "日主" : pillar.tenGod || "—")}
                        {rowIndex === 3 && (
                          <span className="text-xs leading-tight block space-x-1">
                            {pillar.hiddenStems?.map((hs) => (
                              <span key={hs} className={STEM_COLORS[hs] ?? ""}>
                                {hs}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

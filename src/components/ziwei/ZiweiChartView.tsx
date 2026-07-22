import type { ZiweiChart } from "@/lib/types/ziwei";
import { Card } from "@/components/ui";
import { PalaceGrid } from "./PalaceGrid";
import { StarBadge } from "./StarBadge";

type Props = {
  chart: ZiweiChart;
};

const PALACE_ORDER = [
  "命宫",
  "兄弟",
  "夫妻",
  "子女",
  "财帛",
  "疾厄",
  "迁移",
  "交友",
  "官禄",
  "田宅",
  "福德",
  "父母",
] as const;

export function ZiweiChartView({ chart }: Props) {
  const majorEntries = PALACE_ORDER.map((name) => ({
    name,
    stars: chart.majorStars[name] ?? [],
  })).filter((e) => e.stars.length > 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card title="十二宫命盘" glow="gold" subtitle="地支固定方位 · 主星落宫">
        <PalaceGrid chart={chart} />
      </Card>

      <Card title="主星索引" glow="cyan" subtitle="十四主星按宫速览">
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {majorEntries.map(({ name, stars }) => (
            <li
              key={name}
              className="rounded-lg border border-border/60 bg-surface-elevated/60 px-2.5 py-2"
            >
              <p className="text-[10px] text-muted mb-1">{name}</p>
              <div className="flex flex-wrap gap-1">
                {stars.map((s) => (
                  <StarBadge
                    key={s}
                    star={{ name: s, category: "major" }}
                    size="md"
                  />
                ))}
              </div>
            </li>
          ))}
          {majorEntries.length === 0 ? (
            <li className="col-span-full text-sm text-muted">暂无主星数据</li>
          ) : null}
        </ul>
      </Card>

      {chart.flags.length > 0 ? (
        <Card title="排盘标记">
          <div className="flex flex-wrap gap-1.5">
            {chart.flags.map((f) => (
              <span
                key={f}
                className="text-[10px] px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/25"
              >
                {f}
              </span>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

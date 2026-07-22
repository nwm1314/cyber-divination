import type { ChartRelations, HehuaDetail } from "@/lib/types";

type Props = {
  relations: ChartRelations;
};

type ChipItem = {
  label: string;
  hehua?: HehuaDetail;
};

function chips(items: ChipItem[], className: string): React.ReactNode {
  if (items.length === 0) return null;
  return items.map((r) => {
    const tag = r.hehua?.tag;
    const key = tag ? `${r.label}-${tag}` : r.label;
    return (
      <span
        key={key}
        className={`inline-flex items-center gap-1 mr-2 mb-1 px-2 py-0.5 rounded-md border text-xs ${className}`}
        title={
          r.hehua
            ? `得令${r.hehua.deLing ? "✓" : "✗"} · 得地${r.hehua.deDi ? "✓" : "✗"} · 相邻${r.hehua.adjacent ? "✓" : "✗"}`
            : undefined
        }
      >
        {r.label}
        {tag ? (
          <span
            className={
              tag === "合化"
                ? "text-[10px] px-1 rounded bg-gold/20 text-gold border border-gold/40"
                : "text-[10px] px-1 rounded bg-muted/30 text-muted border border-border"
            }
          >
            {tag}
          </span>
        ) : null}
      </span>
    );
  });
}

export function RelationsPanel({ relations }: Props) {
  const he = relations?.stemHe ?? [];
  const ch = relations?.branchChong ?? [];
  const liuhe = relations?.branchLiuhe ?? [];
  const sanhe = relations?.branchSanhe ?? [];
  const sanhui = relations?.branchSanhui ?? [];
  const xing = relations?.branchXing ?? [];
  const hai = relations?.branchHai ?? [];

  const empty =
    he.length === 0 &&
    ch.length === 0 &&
    liuhe.length === 0 &&
    sanhe.length === 0 &&
    sanhui.length === 0 &&
    xing.length === 0 &&
    hai.length === 0;

  if (empty) {
    return (
      <p className="text-sm text-muted">
        原局未见核心天干五合或地支冲合刑害会。
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {he.length > 0 ? (
        <p>
          <span className="text-muted mr-2">天干合</span>
          {chips(he, "border-gold/30 text-gold")}
        </p>
      ) : null}
      {ch.length > 0 ? (
        <p>
          <span className="text-muted mr-2">地支冲</span>
          {chips(ch, "border-cyan/30 text-cyan")}
        </p>
      ) : null}
      {liuhe.length > 0 ? (
        <p>
          <span className="text-muted mr-2">六合</span>
          {chips(liuhe, "border-emerald-400/30 text-emerald-400")}
        </p>
      ) : null}
      {sanhe.length > 0 ? (
        <p>
          <span className="text-muted mr-2">三合</span>
          {chips(sanhe, "border-violet-400/30 text-violet-300")}
        </p>
      ) : null}
      {sanhui.length > 0 ? (
        <p>
          <span className="text-muted mr-2">三会</span>
          {chips(sanhui, "border-amber-400/30 text-amber-300")}
        </p>
      ) : null}
      {xing.length > 0 ? (
        <p>
          <span className="text-muted mr-2">刑</span>
          {chips(xing, "border-orange-400/30 text-orange-300")}
        </p>
      ) : null}
      {hai.length > 0 ? (
        <p>
          <span className="text-muted mr-2">害</span>
          {chips(hai, "border-rose-400/30 text-rose-300")}
        </p>
      ) : null}
      <p className="text-[10px] text-muted/70">
        合化须得令、得地且天干相邻；不满足则为合绊（力量牵制）。条件表驱动，仅供参考。
      </p>
    </div>
  );
}

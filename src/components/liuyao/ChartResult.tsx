"use client";

import type { LiuyaoChart, LiuyaoMethod } from "@/lib/types/liuyao";
import { Card } from "@/components/ui";
import { SCHOOL_LABEL } from "@/lib/liuyao/cast/method";
import { HexagramVisual } from "./HexagramVisual";

const METHOD_LABEL: Record<LiuyaoMethod, string> = {
  coins: "三钱纳甲",
  time: "梅花时间→纳甲",
  manual: "手工纳甲",
};

const YAO_VALUE_LABEL: Record<number, string> = {
  6: "老阴 ×",
  7: "少阳 —",
  8: "少阴 --",
  9: "老阳 ○",
};

export type ChartResultProps = {
  chart: LiuyaoChart;
};

/** 结果页结构化字段（解读留给 T114） */
export function ChartResult({ chart }: ChartResultProps) {
  const dong = chart.lines.filter((l) => l.changing);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Card glow="gold" title="所问事项" subtitle="一事一问 · 针对本次">
        <p className="text-base leading-relaxed text-foreground/95">
          {chart.question}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted text-xs mb-0.5">起卦方式</dt>
            <dd className="text-cyan">{METHOD_LABEL[chart.method]}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs mb-0.5">流派标识</dt>
            <dd className="text-muted text-xs">
              {chart.meta.castingSchool
                ? SCHOOL_LABEL[chart.meta.castingSchool]
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs mb-0.5">引擎</dt>
            <dd className="text-muted font-mono text-xs">
              v{chart.meta.engineVersion}
            </dd>
          </div>
          {chart.meta.timezone ? (
            <div>
              <dt className="text-muted text-xs mb-0.5">时区</dt>
              <dd className="text-muted font-mono text-xs">
                {chart.meta.timezone}
              </dd>
            </div>
          ) : null}
          {chart.meta.replaySeed != null ? (
            <div className="col-span-2">
              <dt className="text-muted text-xs mb-0.5">复盘种子</dt>
              <dd className="text-muted font-mono text-xs break-all">
                {String(chart.meta.replaySeed)}
              </dd>
            </div>
          ) : null}
        </dl>
        {chart.meta.methodNote ? (
          <p className="mt-3 text-[11px] text-muted leading-relaxed">
            {chart.meta.methodNote}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <HexagramVisual
          title="本卦"
          gua={chart.benGua}
          lines={chart.lines}
          shiYao={chart.shiYao}
          yingYao={chart.yingYao}
        />
        {chart.bianGua ? (
          <HexagramVisual
            title="变卦"
            gua={chart.bianGua}
            lines={chart.lines.map((l) => {
              // 变卦展示：动爻变后的阴阳（仅可视化阴阳，值用变后静爻）
              if (!l.changing) return { ...l, changing: false };
              const next = l.value === 6 ? 7 : l.value === 9 ? 8 : l.value;
              return {
                yao: l.yao,
                value: next as 6 | 7 | 8 | 9,
                changing: false,
              };
            })}
            compact
          />
        ) : (
          <Card title="变卦" subtitle="本卦无动爻">
            <p className="text-sm text-muted leading-relaxed">
              六爻皆静，无变卦。断事以本卦为主。
            </p>
          </Card>
        )}
      </div>

      <Card title="六爻明细" glow="cyan">
        <ul className="space-y-2 text-sm">
          {[...chart.lines]
            .sort((a, b) => b.yao - a.yao)
            .map((l) => (
              <li
                key={l.yao}
                className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-muted w-10">
                  {["", "初", "二", "三", "四", "五", "上"][l.yao]}爻
                </span>
                <span className={l.changing ? "text-gold" : "text-foreground"}>
                  {YAO_VALUE_LABEL[l.value] ?? l.value}
                </span>
                {l.changing ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">
                    动
                  </span>
                ) : null}
                {chart.shiYao === l.yao ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/90 border border-gold/25">
                    世
                  </span>
                ) : null}
                {chart.yingYao === l.yao ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan border border-cyan/25">
                    应
                  </span>
                ) : null}
                {l.liuqin ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted border border-border/80">
                    {l.liuqin}
                    {l.branch ? `·${l.branch}` : ""}
                  </span>
                ) : null}
                {l.liushen ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted border border-border/70">
                    {l.liushen}
                  </span>
                ) : null}
                {l.yuePo ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/25">
                    月破
                  </span>
                ) : null}
                {l.riChong ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
                    日冲
                  </span>
                ) : null}
                {l.fushen ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted border border-dashed border-border">
                    伏{l.fushen}
                    {l.fushenBranch ? l.fushenBranch : ""}
                  </span>
                ) : null}
                {chart.yongShenYao === l.yao ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/15 text-cyan border border-cyan/35">
                    用
                  </span>
                ) : null}
              </li>
            ))}
        </ul>
        {dong.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            动爻：
            {dong
              .map(
                (l) =>
                  `${["", "初", "二", "三", "四", "五", "上"][l.yao]}爻(${YAO_VALUE_LABEL[l.value]})`,
              )
              .join("、")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">无动爻</p>
        )}
        {chart.yongShen ? (
          <p className="mt-2 text-sm">
            <span className="text-muted">用神：</span>
            <span className="text-cyan">{chart.yongShen}</span>
            {chart.yongShenYao != null &&
            chart.yongShenYao >= 1 &&
            chart.yongShenYao <= 6 ? (
              <span className="text-muted">
                {" "}
                · 第{chart.yongShenYao}爻
              </span>
            ) : null}
          </p>
        ) : null}
      </Card>

      <p className="text-xs text-muted leading-relaxed text-center px-2">
        以上为确定性装卦结果，仅供传统文化学习与娱乐参考，不构成决策依据。大事请理性判断并听取专业意见。
      </p>
    </div>
  );
}

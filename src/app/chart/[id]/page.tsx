"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { BaziChart, ViewMode } from "@/lib/types";
import { getChart, getProfile } from "@/lib/storage";
import { getPrefs } from "@/lib/prefs";
import { labelFlag } from "@/lib/bazi/calendar";
import {
  computeYongshen,
  WUXING_LABEL_ZH,
  type WuxingKey,
} from "@/lib/bazi/yongshen";
import { STEM_WUXING } from "@/lib/bazi/wuxing";
import { analyzeChart } from "@/lib/reading/template/analyze";
import { Card, Button } from "@/components/ui";
import { TrustPanel } from "@/components/reading";
import {
  BaziTable,
  WuxingBars,
  DayunTimeline,
  LiunianStrip,
  ViewToggle,
  RelationsPanel,
  formatStartAgeDetail,
} from "@/components/chart";

function useDefaultViewMode(): ViewMode {
  return useSyncExternalStore(
    () => () => {},
    () => getPrefs().defaultViewMode,
    () => "plain" as ViewMode,
  );
}

const DAY_MASTER_PROFILES: Record<string, { element: string; image: string }> = {
  甲: { element: "木", image: "参天大树，正直向上；有领导力与担当精神" },
  乙: { element: "木", image: "藤蔓花草，柔韧善变；适应力强，婉约细腻" },
  丙: { element: "火", image: "太阳之火，热烈明亮；热情开朗，感染力强" },
  丁: { element: "火", image: "灯烛之火，温暖内敛；细腻敏感，洞察入微" },
  戊: { element: "土", image: "厚重高山，诚信敦厚；包容沉稳，成人之美" },
  己: { element: "土", image: "田园沃土，平和滋养；亲和务实，善于规划" },
  庚: { element: "金", image: "斧钺之金，刚毅果决；意志坚定，变革进取" },
  辛: { element: "金", image: "珠玉之金，精致内秀；品味高雅，追求完美" },
  壬: { element: "水", image: "江河之水，浩瀚奔放；智慧通达，善变能容" },
  癸: { element: "水", image: "雨露之水，灵活渗透；含蓄内敛，谋定后动" },
};

const ELEMENT_COLORS: Record<string, string> = {
  wood: "text-emerald-400",
  fire: "text-red-400",
  earth: "text-amber-400",
  metal: "text-zinc-200",
  water: "text-cyan-400",
};

const EMPTY_RELATIONS = {
  stemHe: [],
  branchChong: [],
  branchLiuhe: [],
  branchSanhe: [],
  branchSanhui: [],
  branchXing: [],
  branchHai: [],
};

export default function ChartPage() {
  const params = useParams();
  const chartId = params?.id as string;
  const prefView = useDefaultViewMode();
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const viewMode = viewOverride ?? prefView;
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [tick, setTick] = useState(0);

  const { chart, name } = useMemo(() => {
    void tick;
    if (!mounted) {
      return { chart: null as BaziChart | null, name: "" };
    }
    return {
      chart: getChart(chartId),
      name: getProfile(chartId)?.name ?? "",
    };
  }, [chartId, tick, mounted]);

  if (!chartId) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-muted">缺少命盘 ID</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">加载命盘中…</p>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
          <p className="text-muted">未找到本地命盘，请先完成信息采集与排盘。</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/chart/new">
              <Button>新建命盘</Button>
            </Link>
            <Link href="/charts">
              <Button variant="secondary">我的档案</Button>
            </Link>
            <Button variant="ghost" onClick={() => setTick((t) => t + 1)}>
              重新加载
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const profile = DAY_MASTER_PROFILES[chart.dayMaster];
  const dmWx = (STEM_WUXING[chart.dayMaster as keyof typeof STEM_WUXING] ??
    "earth") as WuxingKey;
  const analysis = analyzeChart(chart);
  const yong = computeYongshen(chart, analysis.strength);
  const pattern = analysis.patternName;
  const current = chart.dayun.find(
    (d) => !d.isPreDayun && d.index === chart.currentDayunIndex,
  );
  const thisYear = new Date().getFullYear();
  const liu = chart.liunian.find((l) => l.year === thisYear);
  const startAgeLabel = formatStartAgeDetail(chart.startAgeDetail);

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-6xl mx-auto w-full gap-4 sm:gap-6 pb-8">
        <header className="flex items-center flex-wrap gap-3 pt-2">
          <Link
            href="/charts"
            className="text-xs text-muted hover:text-gold transition-colors"
          >
            ← 档案
          </Link>
          <h1 className="text-lg font-bold tracking-wider text-gold">
            命盘总览
            {name ? (
              <span className="text-sm font-normal text-muted ml-2">{name}</span>
            ) : null}
          </h1>
          <ViewToggle value={viewMode} onChange={setViewOverride} />
          {chart.flags.map((f) => (
            <span
              key={f}
              className="text-[10px] px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/25"
            >
              {labelFlag(f)}
            </span>
          ))}
          <Link href={`/chart/${chartId}/reading`} className="ml-auto">
            <Button size="sm">综合解读</Button>
          </Link>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="lg:col-span-3 space-y-4 sm:space-y-5">
            <Card title="四柱八字" glow="gold">
              <BaziTable pillars={chart.pillars} dayMaster={chart.dayMaster} />
            </Card>

            <Card title="五行力量" glow="cyan">
              <WuxingBars
                scores={chart.wuxingScores}
                dayMaster={chart.dayMaster}
                viewMode={viewMode}
                chart={chart}
              />
            </Card>

            <Card title="干支关系" glow="cyan">
              <RelationsPanel relations={chart.relations ?? EMPTY_RELATIONS} />
            </Card>

            <Card title="大运走势">
              <DayunTimeline
                dayun={chart.dayun}
                currentDayunIndex={chart.currentDayunIndex}
                startAgeDetail={chart.startAgeDetail}
              />
            </Card>

            <Card title="流年">
              <LiunianStrip liunian={chart.liunian} highlightYear={thisYear} />
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            {viewMode === "plain" ? (
              <>
                <Card title="日主画像" glow="gold">
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed">
                      您是
                      <strong className="text-gold">{chart.dayMaster}</strong>
                      <strong className={ELEMENT_COLORS[dmWx]}>
                        {profile?.element ?? ""}
                      </strong>
                      日主，{profile?.image ?? "需结合全盘细看。"}
                    </p>
                    <div className="h-px bg-border/40" />
                    <div>
                      <h3 className="text-xs font-semibold text-muted mb-1">
                        喜用建议
                      </h3>
                      <p className="text-sm leading-relaxed">{yong.plainLine}</p>
                    </div>
                  </div>
                </Card>

                <Card title="当前运势">
                  <div className="space-y-2 text-sm">
                    {startAgeLabel ? (
                      <p className="text-muted text-xs">{startAgeLabel}</p>
                    ) : null}
                    <p>
                      当前大运：
                      <strong className="text-gold">
                        {current ? `${current.stem}${current.branch}` : "—"}
                      </strong>
                      {current ? (
                        <span className="text-muted ml-1">
                          （{current.startAge}–{current.endAge}岁）
                        </span>
                      ) : null}
                    </p>
                    <p>
                      当前流年：
                      <strong className="text-cyan">
                        {liu ? `${liu.stem}${liu.branch}` : "—"}
                      </strong>
                      <span className="text-muted ml-1">（{thisYear}年）</span>
                    </p>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card title="格局判定" glow="gold">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted">格局</span>
                      <span className="text-sm font-bold text-gold">
                        {pattern}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted">旺衰</span>
                      <span className="text-sm text-cyan">{analysis.strength}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted">用神倾向</span>
                      <span
                        className={`text-sm font-bold ${ELEMENT_COLORS[yong.favorable[0]]}`}
                      >
                        {yong.favorable
                          .map((k) => WUXING_LABEL_ZH[k])
                          .join("、")}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted">忌神倾向</span>
                      <span className="text-sm text-muted">
                        {yong.unfavorable
                          .map((k) => WUXING_LABEL_ZH[k])
                          .join("、")}
                      </span>
                    </div>
                    <p className="text-xs text-muted/70 leading-relaxed">
                      {analysis.patternDesc}
                    </p>
                  </div>
                </Card>

                <Card title="当前大运">
                  <div className="space-y-1 text-sm">
                    {startAgeLabel ? (
                      <p className="text-xs text-muted">{startAgeLabel}</p>
                    ) : null}
                    <p>
                      <span className="text-gold font-bold">
                        {current ? `${current.stem}${current.branch}` : "—"}
                      </span>
                      {current ? (
                        <span className="text-muted ml-2">
                          {current.startAge}–{current.endAge}岁（{current.startYear}
                          –{current.endYear}）
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Card>

                <Card title="流年提示">
                  <ul className="space-y-1.5 text-sm">
                    {chart.liunian.map((l) => (
                      <li key={l.year} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-cyan" />
                        <span className="text-muted">{l.year}年</span>
                        <strong className="text-cyan">
                          {l.stem}
                          {l.branch}
                        </strong>
                        <span className="text-muted"> · {l.age}岁</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}

            <TrustPanel
              viewMode={viewMode}
              school={chart.meta?.school}
              engineVersion={chart.meta?.engineVersion}
              skillRef={chart.meta?.skillRef}
              warnings={chart.warnings}
              evidence={chart.evidence}
              methodNote="专业模式可查看规则 evidence 与引擎版本；通俗模式同样显示边界警告。"
            />

            <Card title="下一步">
              <div className="flex flex-col gap-2">
                <Link href={`/chart/${chartId}/reading`}>
                  <Button className="w-full">查看综合解读</Button>
                </Link>
                <Link href="/chart/new">
                  <Button variant="ghost" className="w-full">
                    再建一盘
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

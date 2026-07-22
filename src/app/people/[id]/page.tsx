"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getPerson,
  linkChartId,
  linkZiweiId,
  listCharts,
  listZiweiCharts,
  unlinkChartId,
  unlinkZiweiId,
  type ListEntry,
  type ZiweiListEntry,
} from "@/lib/storage";
import type { Person } from "@/lib/types/user";
import { Button, Card } from "@/components/ui";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function genderLabel(g?: "male" | "female"): string {
  if (g === "male") return "男";
  if (g === "female") return "女";
  return "未填";
}

export default function PersonDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const isClient = useIsClient();

  const [person, setPerson] = useState<Person | null>(null);
  const [allCharts, setAllCharts] = useState<ListEntry[]>([]);
  const [allZiwei, setAllZiwei] = useState<ZiweiListEntry[]>([]);
  const [linkChart, setLinkChart] = useState("");
  const [linkZiwei, setLinkZiwei] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!id) {
      setPerson(null);
      return;
    }
    setPerson(getPerson(id));
    setAllCharts(listCharts());
    setAllZiwei(listZiweiCharts());
  }, [id]);

  useEffect(() => {
    if (!isClient) return;
    const frame = requestAnimationFrame(() => {
      refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [isClient, refresh]);

  const chartMap = useMemo(() => {
    const m = new Map<string, ListEntry>();
    for (const c of allCharts) m.set(c.profileId, c);
    return m;
  }, [allCharts]);

  const ziweiMap = useMemo(() => {
    const m = new Map<string, ZiweiListEntry>();
    for (const z of allZiwei) m.set(z.chartId, z);
    return m;
  }, [allZiwei]);

  const linkedChartIds = useMemo(
    () => person?.chartIds ?? [],
    [person?.chartIds],
  );
  const linkedZiweiIds = useMemo(
    () => person?.ziweiIds ?? [],
    [person?.ziweiIds],
  );

  const freeCharts = useMemo(
    () => allCharts.filter((c) => !linkedChartIds.includes(c.profileId)),
    [allCharts, linkedChartIds],
  );
  const freeZiwei = useMemo(
    () => allZiwei.filter((z) => !linkedZiweiIds.includes(z.chartId)),
    [allZiwei, linkedZiweiIds],
  );

  const onLinkChart = useCallback(() => {
    if (!id || !linkChart) return;
    const next = linkChartId(id, linkChart);
    if (next) {
      setPerson(next);
      setLinkChart("");
      setMsg("已关联八字盘");
    }
  }, [id, linkChart]);

  const onUnlinkChart = useCallback(
    (chartId: string) => {
      if (!id) return;
      if (!confirm("取消关联该八字盘？（不删除命盘本身）")) return;
      const next = unlinkChartId(id, chartId);
      if (next) {
        setPerson(next);
        setMsg("已取消八字关联");
      }
    },
    [id],
  );

  const onLinkZiwei = useCallback(() => {
    if (!id || !linkZiwei) return;
    const next = linkZiweiId(id, linkZiwei);
    if (next) {
      setPerson(next);
      setLinkZiwei("");
      setMsg("已关联紫微盘");
    }
  }, [id, linkZiwei]);

  const onUnlinkZiwei = useCallback(
    (ziweiId: string) => {
      if (!id) return;
      if (!confirm("取消关联该紫微盘？（不删除命盘本身）")) return;
      const next = unlinkZiweiId(id, ziweiId);
      if (next) {
        setPerson(next);
        setMsg("已取消紫微关联");
      }
    },
    [id],
  );

  if (!isClient) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
          <Card title="加载中">
            <p className="text-sm text-muted">正在读取人物…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!id || !person) {
    return (
      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
        <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
          <header className="flex items-center justify-between gap-3 pt-2">
            <Link
              href="/people"
              className="text-sm text-muted hover:text-cyan transition-colors"
            >
              ← 人物
            </Link>
            <h1 className="text-base font-medium text-gold tracking-wide">
              人物详情
            </h1>
            <span className="w-10" />
          </header>
          <Card title="未找到人物" subtitle="档案可能已删除或不存在">
            <Link href="/people">
              <Button size="sm">返回人物列表</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/people"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 人物
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide truncate max-w-[50%]">
            {person.name}
          </h1>
          <Link
            href="/charts"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            盘库
          </Link>
        </header>

        <Card
          title={person.name}
          subtitle={`${genderLabel(person.gender)}${person.solarDate ? ` · 阳历 ${person.solarDate}` : ""}${person.birthTime ? ` · ${person.birthTime}` : ""}`}
          glow="gold"
        >
          <p className="text-xs text-muted leading-relaxed">
            八字 {linkedChartIds.length} 盘 · 紫微 {linkedZiweiIds.length} 盘
            {person.birthPlace
              ? ` · ${person.birthPlace.province}${person.birthPlace.city}`
              : ""}
          </p>
          {msg && (
            <p className="text-xs text-cyan mt-2 leading-relaxed">{msg}</p>
          )}
        </Card>

        <section aria-labelledby="bazi-links" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="bazi-links"
              className="text-sm font-medium tracking-wide text-gold"
            >
              八字盘
            </h2>
            <Link
              href="/chart/new"
              className="text-xs text-cyan hover:underline"
            >
              新建八字
            </Link>
          </div>

          {linkedChartIds.length === 0 ? (
            <Card title="尚未关联八字" subtitle="可关联已有档案，或去排盘">
              <p className="text-sm text-muted mb-3 leading-relaxed">
                关联后可从本页直达看盘 / 解读。
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {linkedChartIds.map((cid) => {
                const meta = chartMap.get(cid);
                return (
                  <li key={cid}>
                    <Card className="!p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {meta?.name ?? "八字盘"}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {meta?.date ? `基准日 ${meta.date} · ` : ""}
                            {cid.slice(0, 12)}…
                          </p>
                          {!meta && (
                            <p className="text-[11px] text-danger/80 mt-0.5">
                              本地未找到该盘（可能已删）
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {meta ? (
                            <>
                              <Link href={`/chart/${cid}`}>
                                <Button size="sm" variant="secondary">
                                  看盘
                                </Button>
                              </Link>
                              <Link href={`/chart/${cid}/reading`}>
                                <Button size="sm">解读</Button>
                              </Link>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onUnlinkChart(cid)}
                          >
                            取消关联
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          {freeCharts.length > 0 && (
            <Card title="关联已有八字" subtitle="从本机档案中选择">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={linkChart}
                  onChange={(e) => setLinkChart(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-cyan/50"
                >
                  <option value="">选择八字盘…</option>
                  {freeCharts.map((c) => (
                    <option key={c.profileId} value={c.profileId}>
                      {c.name} · {c.date}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!linkChart}
                  onClick={onLinkChart}
                >
                  关联
                </Button>
              </div>
            </Card>
          )}
        </section>

        <section aria-labelledby="ziwei-links" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="ziwei-links"
              className="text-sm font-medium tracking-wide text-gold"
            >
              紫微盘
            </h2>
            <Link
              href="/ziwei/new"
              className="text-xs text-cyan hover:underline"
            >
              新建紫微
            </Link>
          </div>

          {linkedZiweiIds.length === 0 ? (
            <Card title="尚未关联紫微" subtitle="可关联已有紫微盘，或去排盘">
              <p className="text-sm text-muted mb-3 leading-relaxed">
                紫微与八字分体系存储，在此统一按人查看。
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {linkedZiweiIds.map((zid) => {
                const meta = ziweiMap.get(zid);
                return (
                  <li key={zid}>
                    <Card className="!p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {meta?.name ?? "紫微盘"}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {meta?.date ? `${meta.date} · ` : ""}
                            {zid.slice(0, 12)}…
                          </p>
                          {!meta && (
                            <p className="text-[11px] text-danger/80 mt-0.5">
                              本地未找到该盘（可能已删）
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {meta ? (
                            <>
                              <Link href={`/ziwei/${zid}`}>
                                <Button size="sm" variant="secondary">
                                  看盘
                                </Button>
                              </Link>
                              <Link href={`/ziwei/${zid}/reading`}>
                                <Button size="sm">解读</Button>
                              </Link>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onUnlinkZiwei(zid)}
                          >
                            取消关联
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          {freeZiwei.length > 0 && (
            <Card title="关联已有紫微" subtitle="从本机紫微列表中选择">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={linkZiwei}
                  onChange={(e) => setLinkZiwei(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-cyan/50"
                >
                  <option value="">选择紫微盘…</option>
                  {freeZiwei.map((z) => (
                    <option key={z.chartId} value={z.chartId}>
                      {z.name} · {z.date}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!linkZiwei}
                  onClick={onLinkZiwei}
                >
                  关联
                </Button>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  listCharts,
  deleteChart,
  listZiweiCharts,
  type ListEntry,
  type ZiweiListEntry,
} from "@/lib/storage";
import {
  pullCloudChartsToLocal,
  pushLocalChartsToCloud,
} from "@/lib/storage/sync";
import {
  markMigrateDone,
  runMigrateFromLocal,
  shouldShowMigratePrompt,
  skipMigratePrompt,
} from "@/lib/storage/migrate";
import { Button, Card } from "@/components/ui";
import { GuestBanner } from "@/components/GuestBanner";
import type { AppSession } from "@/lib/types/user";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function ChartsPage() {
  const isClient = useIsClient();
  const [list, setList] = useState<ListEntry[]>([]);
  const [ziweiList, setZiweiList] = useState<ZiweiListEntry[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [showMigrate, setShowMigrate] = useState(false);

  const refreshList = useCallback(() => {
    setList(listCharts());
    setZiweiList(listZiweiCharts());
  }, []);

  useEffect(() => {
    if (!isClient) return;
    // 异步读本地，避免 effect 内同步 setState 触发 lint
    const id = requestAnimationFrame(() => {
      setList(listCharts());
      setZiweiList(listZiweiCharts());
    });
    return () => cancelAnimationFrame(id);
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { session?: AppSession };
        const authed = !!body.session?.authenticated;
        const uid = body.session?.userId ?? null;
        if (cancelled) return;
        setLoggedIn(authed);
        setUserId(uid);
        if (authed && uid && shouldShowMigratePrompt(uid)) {
          setShowMigrate(true);
        }
      } catch {
        if (!cancelled) {
          setLoggedIn(false);
          setUserId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClient]);

  const onDelete = useCallback(
    (id: string) => {
      if (!confirm("确定删除该档案？不可恢复。")) return;
      deleteChart(id);
      refreshList();
    },
    [refreshList],
  );

  const onPush = useCallback(async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const r = await pushLocalChartsToCloud();
      const failHint =
        r.failed.length > 0 ? `，失败 ${r.failed.length} 条` : "";
      setSyncMsg(`已推送 ${r.pushed} 条到云端${failHint}`);
    } catch {
      setSyncMsg("推送失败，请确认已登录");
    } finally {
      setSyncBusy(false);
    }
  }, []);

  const onPull = useCallback(async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const r = await pullCloudChartsToLocal();
      refreshList();
      const failHint =
        r.failed.length > 0 ? `，失败 ${r.failed.length} 条` : "";
      setSyncMsg(`已从云端拉取 ${r.pulled} 条${failHint}`);
    } catch {
      setSyncMsg("拉取失败，请确认已登录");
    } finally {
      setSyncBusy(false);
    }
  }, [refreshList]);

  const onMigrate = useCallback(async () => {
    if (!userId) return;
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const r = await runMigrateFromLocal();
      refreshList();
      if (r.ok) {
        markMigrateDone(userId);
        setShowMigrate(false);
        setSyncMsg(r.message);
      } else {
        setSyncMsg(r.message || "合并失败");
      }
    } catch {
      setSyncMsg("合并失败，请确认已登录");
    } finally {
      setSyncBusy(false);
    }
  }, [userId, refreshList]);

  const onSkipMigrate = useCallback(() => {
    if (userId) skipMigratePrompt(userId);
    setShowMigrate(false);
    setSyncMsg("已跳过本次合并，可稍后在云端同步中手动操作");
  }, [userId]);

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 首页
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            我的档案
          </h1>
          <Link href="/chart/new">
            <Button size="sm">新建八字</Button>
          </Link>
        </header>

        <GuestBanner />

        <nav className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full border border-gold/40 bg-gold/10 text-gold">
            八字
          </span>
          <Link
            href="/ziwei"
            className="px-2.5 py-1 rounded-full border border-border text-muted hover:border-cyan/40 hover:text-cyan transition-colors"
          >
            紫微{ziweiList.length > 0 ? ` · ${ziweiList.length}` : ""}
          </Link>
          <Link
            href="/liuyao"
            className="px-2.5 py-1 rounded-full border border-border text-muted hover:border-cyan/40 hover:text-cyan transition-colors"
          >
            六爻
          </Link>
          <Link
            href="/people"
            className="px-2.5 py-1 rounded-full border border-border text-muted hover:border-gold/40 hover:text-gold transition-colors"
          >
            人物
          </Link>
        </nav>

        {isClient && loggedIn && showMigrate && (
          <Card
            title="合并本机档案到云端"
            subtitle="检测到本机有档案。合并按 id / 更新时间处理冲突，不会删除任何一侧数据"
          >
            <p className="text-xs text-muted mb-3 leading-relaxed">
              同 id 保留较新；仅本地则上传；仅云端则拉取。也可跳过本次。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={syncBusy}
                onClick={() => void onMigrate()}
              >
                立即合并
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={syncBusy}
                onClick={onSkipMigrate}
              >
                跳过本次
              </Button>
            </div>
          </Card>
        )}

        {isClient && loggedIn && (
          <Card title="云端同步" subtitle="登录后可将本机档案与云端互相同步">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={syncBusy}
                onClick={() => void onPush()}
              >
                同步到云端
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={syncBusy}
                onClick={() => void onPull()}
              >
                从云端拉取
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={syncBusy}
                onClick={() => void onMigrate()}
              >
                智能合并
              </Button>
            </div>
            {syncMsg && (
              <p className="text-xs text-muted mt-3 leading-relaxed">{syncMsg}</p>
            )}
            <p className="text-xs text-muted mt-2 leading-relaxed">
              拉取会覆盖本机同 id；智能合并按更新时间择优，且可跳过首次引导。
            </p>
          </Card>
        )}

        <section aria-labelledby="bazi-archives" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="bazi-archives"
              className="text-sm font-medium tracking-wide text-gold"
            >
              八字档案
            </h2>
            <Link
              href="/chart/new"
              className="text-xs text-cyan hover:underline"
            >
              新建
            </Link>
          </div>
          {!isClient ? (
            <Card title="加载中">
              <p className="text-sm text-muted">正在读取本机档案…</p>
            </Card>
          ) : list.length === 0 ? (
            <Card title="暂无八字档案" subtitle="排盘结果会保存在本机浏览器">
              <p className="text-sm text-muted mb-4 leading-relaxed">
                完成引导采集后即可在此查看历史命盘。
                {loggedIn
                  ? " 已登录可从上方「从云端拉取」恢复跨设备档案。"
                  : ""}
              </p>
              <Link href="/chart/new">
                <Button>开始排盘</Button>
              </Link>
            </Card>
          ) : (
            <ul className="space-y-3">
              {list.map((item) => (
                <li key={item.profileId}>
                  <Card className="!p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          基准日 {item.date} · {item.profileId.slice(0, 12)}…
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/chart/${item.profileId}`}>
                          <Button size="sm" variant="secondary">
                            看盘
                          </Button>
                        </Link>
                        <Link href={`/chart/${item.profileId}/reading`}>
                          <Button size="sm">解读</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(item.profileId)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isClient && (
          <section aria-labelledby="ziwei-archives" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="ziwei-archives"
                className="text-sm font-medium tracking-wide text-gold"
              >
                紫微命盘
                {ziweiList.length > 0 ? (
                  <span className="text-muted font-normal ml-1">
                    · {ziweiList.length}
                  </span>
                ) : null}
              </h2>
              <Link href="/ziwei" className="text-xs text-cyan hover:underline">
                全部
              </Link>
            </div>
            {ziweiList.length === 0 ? (
              <Card title="暂无紫微盘" subtitle="本地存储，刷新不丢">
                <p className="text-sm text-muted mb-4 leading-relaxed">
                  紫微盘与八字档案分开保存；云端同步可选，尚未接入。
                </p>
                <Link href="/ziwei/new">
                  <Button size="sm">排紫微盘</Button>
                </Link>
              </Card>
            ) : (
              <ul className="space-y-3">
                {ziweiList.slice(0, 5).map((item) => (
                  <li key={item.chartId}>
                    <Card className="!p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {item.date} · {item.chartId.slice(0, 12)}…
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <Link href={`/ziwei/${item.chartId}`}>
                            <Button size="sm" variant="secondary">
                              看盘
                            </Button>
                          </Link>
                          <Link href={`/ziwei/${item.chartId}/reading`}>
                            <Button size="sm">解读</Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            {ziweiList.length > 5 && (
              <Link
                href="/ziwei"
                className="block text-center text-xs text-cyan hover:underline py-1"
              >
                查看全部 {ziweiList.length} 盘 →
              </Link>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

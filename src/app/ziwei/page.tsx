"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  listZiweiCharts,
  deleteZiweiChart,
  type ZiweiListEntry,
} from "@/lib/storage";
import {
  pullCloudZiweiToLocal,
  pushLocalZiweiToCloud,
  deleteArchive,
} from "@/lib/storage/sync";
import { Button, Card } from "@/components/ui";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function ZiweiListPage() {
  const isClient = useIsClient();
  const [list, setList] = useState<ZiweiListEntry[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    setList(listZiweiCharts());
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const id = requestAnimationFrame(() => {
      setList(listZiweiCharts());
    });
    return () => cancelAnimationFrame(id);
  }, [isClient]);

  const onDelete = useCallback(
    (id: string) => {
      if (!confirm("确定只删除本机紫微盘？云端档案不会改变。")) return;
      deleteZiweiChart(id);
      refreshList();
    },
    [refreshList],
  );

  const onDeleteCloud = useCallback(async (id: string) => {
    if (!confirm("确定只删除云端紫微盘？本机档案不会改变。")) return;
    setSyncBusy(true);
    try {
      const result = await deleteArchive({ kind: "ziwei", id, scope: "cloud" });
      setSyncMsg(result.message);
    } catch {
      setSyncMsg("云端删除失败，本机档案已保留");
    } finally {
      setSyncBusy(false);
    }
  }, []);

  const onPush = useCallback(async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const r = await pushLocalZiweiToCloud();
      setSyncMsg(
        `已推送 ${r.pushed} 盘` +
          (r.failed.length ? `；失败 ${r.failed.length}` : ""),
      );
    } catch {
      setSyncMsg("推送失败（需登录）");
    } finally {
      setSyncBusy(false);
    }
  }, []);

  const onPull = useCallback(async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const r = await pullCloudZiweiToLocal();
      refreshList();
      setSyncMsg(
        `已拉取 ${r.pulled} 盘` +
          (r.failed.length ? `；失败 ${r.failed.length}` : ""),
      );
    } catch {
      setSyncMsg("拉取失败（需登录）");
    } finally {
      setSyncBusy(false);
    }
  }, [refreshList]);

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/charts"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 档案
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            紫微命盘
          </h1>
          <Link href="/ziwei/new">
            <Button size="sm">新建</Button>
          </Link>
        </header>

        <p className="text-xs text-muted leading-relaxed">
          紫微盘默认保存在本机；登录后可推送/拉取云端同步（与八字档案并列）。
        </p>

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
            variant="ghost"
            disabled={syncBusy}
            onClick={() => void onPull()}
          >
            从云端拉取
          </Button>
        </div>
        {syncMsg && (
          <p className="text-xs text-muted leading-relaxed">{syncMsg}</p>
        )}

        {!isClient ? (
          <Card title="加载中">
            <p className="text-sm text-muted">正在读取本机紫微盘…</p>
          </Card>
        ) : list.length === 0 ? (
          <Card title="暂无紫微盘" subtitle="排盘结果会保存在本机浏览器">
            <p className="text-sm text-muted mb-4 leading-relaxed">
              完成一次紫微排盘后即可在此查看历史命盘。
            </p>
            <Link href="/ziwei/new">
              <Button>去排紫微盘</Button>
            </Link>
          </Card>
        ) : (
          <ul className="space-y-3">
            {list.map((item) => (
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
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={syncBusy}
                        onClick={() => void onDeleteCloud(item.chartId)}
                      >
                        删除云端
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(item.chartId)}
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
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  listLiuyaoCharts,
  deleteLiuyaoChart,
  type LiuyaoListEntry,
} from "@/lib/storage";
import type { LiuyaoMethod } from "@/lib/types/liuyao";
import { Button, Card } from "@/components/ui";
import { deleteArchive } from "@/lib/storage/sync";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

const METHOD_LABEL: Record<LiuyaoMethod, string> = {
  coins: "铜钱",
  time: "时间",
  manual: "手动",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function LiuyaoHistoryPage() {
  const isClient = useIsClient();
  const [list, setList] = useState<LiuyaoListEntry[]>([]);

  const refreshList = useCallback(() => {
    setList(listLiuyaoCharts());
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const id = requestAnimationFrame(() => {
      setList(listLiuyaoCharts());
    });
    return () => cancelAnimationFrame(id);
  }, [isClient]);

  const onPullCloud = useCallback(async () => {
    try {
      const { pullCloudLiuyaoToLocal } = await import("@/lib/storage/sync");
      await pullCloudLiuyaoToLocal();
      refreshList();
    } catch {
      // ignore
    }
  }, [refreshList]);

  const onPushCloud = useCallback(async () => {
    try {
      const { pushLocalLiuyaoToCloud } = await import("@/lib/storage/sync");
      await pushLocalLiuyaoToCloud();
    } catch {
      // ignore
    }
  }, []);

  const onDelete = useCallback(
    (id: string) => {
      if (!confirm("确定只删除本机问卦？云端档案不会改变。")) return;
      deleteLiuyaoChart(id);
      refreshList();
    },
    [refreshList],
  );

  const onDeleteCloud = useCallback(async (id: string) => {
    if (!confirm("确定只删除云端六爻档案？本机档案不会改变。")) return;
    try {
      const result = await deleteArchive({ kind: "liuyao", id, scope: "cloud" });
      window.alert(result.message);
    } catch {
      window.alert("云端删除失败，本机档案已保留");
    }
  }, []);

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
            问卦历史
          </h1>
          <Link href="/liuyao/new">
            <Button size="sm">起卦</Button>
          </Link>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted leading-relaxed flex-1 min-w-[12rem]">
            一事一问默认保存在本机；登录后可推送到云端，换设备拉取可见历史。
          </p>
          <Button size="sm" variant="secondary" onClick={() => void onPushCloud()}>
            推送云端
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onPullCloud()}>
            拉取云端
          </Button>
        </div>

        {!isClient ? (
          <Card title="加载中">
            <p className="text-sm text-muted">正在读取本机问卦…</p>
          </Card>
        ) : list.length === 0 ? (
          <Card title="暂无问卦" subtitle="起卦结果会保存在本机浏览器">
            <p className="text-sm text-muted mb-4 leading-relaxed">
              完成一次起卦后即可在此查看历史卦象与所问事项。
            </p>
            <Link href="/liuyao/new">
              <Button>去起卦</Button>
            </Link>
          </Card>
        ) : (
          <ul className="space-y-3">
            {list.map((item) => (
              <li key={item.id}>
                <Card className="!p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {item.question || "（无题）"}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {item.benGuaName} · {METHOD_LABEL[item.method] ?? item.method} ·{" "}
                        {formatTime(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Link href={`/liuyao/${item.id}`}>
                        <Button size="sm" variant="secondary">
                          看卦
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDeleteCloud(item.id)}
                      >
                        删除云端
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(item.id)}
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

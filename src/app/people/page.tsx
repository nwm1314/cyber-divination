"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  createPerson,
  deletePerson,
  listPersonEntries,
} from "@/lib/storage";
import type { PersonListEntry } from "@/lib/types/user";
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

function formatUpdated(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function PeoplePage() {
  const isClient = useIsClient();
  const [list, setList] = useState<PersonListEntry[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [solarDate, setSolarDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setList(listPersonEntries());
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const id = requestAnimationFrame(() => {
      setList(listPersonEntries());
    });
    return () => cancelAnimationFrame(id);
  }, [isClient]);

  const onCreate = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const n = name.trim();
      if (!n) {
        setError("请填写姓名");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        createPerson({
          name: n,
          gender: gender || undefined,
          solarDate: solarDate.trim() || undefined,
          chartIds: [],
          ziweiIds: [],
        });
        setName("");
        setGender("");
        setSolarDate("");
        refresh();
      } catch {
        setError("创建失败，请重试");
      } finally {
        setBusy(false);
      }
    },
    [name, gender, solarDate, refresh],
  );

  const onDelete = useCallback(
    (id: string, personName: string) => {
      if (!confirm(`确定删除人物「${personName}」？仅删档案主体，已排命盘仍保留在本地。`)) {
        return;
      }
      deletePerson(id);
      refresh();
    },
    [refresh],
  );

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
            人物档案
          </h1>
          <Link
            href="/charts"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            盘库
          </Link>
        </header>

        <p className="text-xs text-muted leading-relaxed">
          一人可挂多份八字 / 紫微盘。档案保存在本机浏览器，刷新不丢。
        </p>

        <Card title="新建人物" subtitle="最小信息即可，生辰可稍后补全">
          <form onSubmit={onCreate} className="space-y-3">
            <label className="flex flex-col gap-1.5 w-full">
              <span className="text-sm text-foreground/90">
                姓名 <span className="text-danger">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：张三"
                maxLength={40}
                className="h-11 px-3 rounded-lg bg-surface-elevated border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-cyan/50 focus:ring-1 focus:ring-cyan/30"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-sm text-foreground/90">性别</span>
                <select
                  value={gender}
                  onChange={(e) =>
                    setGender(e.target.value as "" | "male" | "female")
                  }
                  className="h-11 px-3 rounded-lg bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-cyan/50"
                >
                  <option value="">未填</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-sm text-foreground/90">阳历生日</span>
                <input
                  type="date"
                  value={solarDate}
                  onChange={(e) => setSolarDate(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-cyan/50"
                />
              </label>
            </div>
            {error && (
              <p className="text-xs text-danger leading-relaxed">{error}</p>
            )}
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "创建中…" : "创建人物"}
            </Button>
          </form>
        </Card>

        <section aria-labelledby="people-list" className="space-y-3">
          <h2
            id="people-list"
            className="text-sm font-medium tracking-wide text-gold"
          >
            人物列表
            {isClient && list.length > 0 ? (
              <span className="text-muted font-normal ml-1">· {list.length}</span>
            ) : null}
          </h2>

          {!isClient ? (
            <Card title="加载中">
              <p className="text-sm text-muted">正在读取本机人物…</p>
            </Card>
          ) : list.length === 0 ? (
            <Card title="暂无人物" subtitle="先建档案，再关联八字 / 紫微盘">
              <p className="text-sm text-muted leading-relaxed">
                创建人物后，可在详情页挂载已有命盘，或跳转新建八字 / 紫微。
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {list.map((item) => (
                <li key={item.id}>
                  <Card className="!p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {genderLabel(item.gender)}
                          {item.solarDate ? ` · ${item.solarDate}` : ""}
                          {" · "}
                          八字 {item.chartCount} · 紫微 {item.ziweiCount}
                        </p>
                        <p className="text-[11px] text-muted/80 mt-0.5">
                          更新 {formatUpdated(item.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Link href={`/people/${item.id}`}>
                          <Button size="sm" variant="secondary">
                            查看
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(item.id, item.name)}
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
      </div>
    </div>
  );
}

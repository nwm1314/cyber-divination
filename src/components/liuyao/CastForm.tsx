"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  LiuyaoMethod,
  LiuyaoQuestionCategory,
  YaoValue,
} from "@/lib/types/liuyao";
import { castLiuyao } from "@/lib/liuyao/cast";
import { CATEGORY_LABEL } from "@/lib/liuyao/analyze/yongshen";
import { saveLiuyaoChart } from "@/lib/storage";
import { Button, Card } from "@/components/ui";
import { Field, inputClass } from "@/components/form/Field";
import { YaoLine, YAO_LABEL } from "./YaoLine";

const METHODS: {
  id: LiuyaoMethod;
  label: string;
  desc: string;
  school: string;
}[] = [
  {
    id: "coins",
    label: "三钱纳甲",
    desc: "六次掷三钱 · 纯纳甲装卦",
    school: "najia-coins",
  },
  {
    id: "time",
    label: "梅花时间",
    desc: "先天数起卦 → 再入纳甲（混合）",
    school: "meihua-time-to-najia",
  },
  {
    id: "manual",
    label: "手工纳甲",
    desc: "自下而上点选六爻",
    school: "najia-manual",
  },
];

const METHOD_DETAIL: Record<LiuyaoMethod, string> = {
  coins:
    "三钱纳甲六爻：模拟六次掷三钱（字/背），按通行编码成六爻，再按京房纳甲安世应、六亲。每次起卦记录复盘种子，引擎版本内可复现。",
  time:
    "梅花时间起卦（混合方法）：以年支+月+日+时的梅花先天数定上下卦与一位动爻，再进入纳甲六爻分析。此法不是纯三钱纳甲起卦，请勿与铜钱法混为一谈。",
  manual:
    "手工指定六爻后按纳甲装卦：自下而上选定少阳/少阴/老阳/老阴，世应六亲规则与铜钱法同一规则层。",
};

const YAO_OPTIONS: YaoValue[] = [7, 8, 9, 6];

const POS_LABEL = ["", "初爻", "二爻", "三爻", "四爻", "五爻", "上爻"] as const;

const CATEGORY_OPTIONS: { id: "" | LiuyaoQuestionCategory; label: string }[] = [
  { id: "", label: "自动（按事项关键词）" },
  ...(
    Object.entries(CATEGORY_LABEL) as [LiuyaoQuestionCategory, string][]
  ).map(([id, label]) => ({ id, label })),
];

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  } catch {
    return "Asia/Shanghai";
  }
}

export function CastForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [method, setMethod] = useState<LiuyaoMethod>("coins");
  const [datetime, setDatetime] = useState(nowLocalDatetime);
  const [lines, setLines] = useState<YaoValue[]>([7, 7, 7, 7, 7, 7]);
  const [category, setCategory] = useState<"" | LiuyaoQuestionCategory>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!question.trim()) return false;
    if (method === "time" && !datetime) return false;
    if (method === "manual" && lines.length !== 6) return false;
    return true;
  }, [question, method, datetime, lines]);

  function setLineAt(index: number, value: YaoValue) {
    setLines((prev) => {
      const next = [...prev] as YaoValue[];
      next[index] = value;
      return next;
    });
  }

  function cycleLine(index: number) {
    setLines((prev) => {
      const next = [...prev] as YaoValue[];
      const cur = next[index] ?? 7;
      const i = YAO_OPTIONS.indexOf(cur);
      next[index] = YAO_OPTIONS[(i + 1) % YAO_OPTIONS.length]!;
      return next;
    });
  }

  function handleCast() {
    setError(null);
    if (!question.trim()) {
      setError("请填写所问事项");
      return;
    }
    setBusy(true);
    try {
      const chart = castLiuyao({
        question: question.trim(),
        method,
        timezone: guessTimezone(),
        ...(method === "time" ? { datetime } : {}),
        ...(method === "manual" ? { lines } : {}),
        ...(category ? { questionCategory: category } : {}),
      });
      saveLiuyaoChart(chart);
      router.push(`/liuyao/${chart.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "起卦失败");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="所问事项"
        subtitle="一事一问；表述尽量具体、单一"
        glow="gold"
      >
        <Field
          label="事项"
          required
          hint="例如：此次面试能否通过、近期合作是否宜推进"
        >
          <textarea
            className={`${inputClass} h-24 py-2 resize-y min-h-[5.5rem]`}
            placeholder="请输入本次所问……"
            value={question}
            maxLength={200}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </Field>
        <p className="mt-1.5 text-[10px] text-muted text-right">
          {question.length}/200
        </p>
        <div className="mt-3">
          <Field
            label="问事类别（可选确认）"
            hint="确认后优先于关键词推断用神；默认自动匹配"
          >
            <select
              className={inputClass}
              value={category}
              onChange={(e) =>
                setCategory(
                  (e.target.value || "") as "" | LiuyaoQuestionCategory,
                )
              }
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.id || "auto"} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="起卦方式"
        subtitle="装卦确定性、零 LLM；方法流派见下方说明"
      >
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label="起卦方式"
        >
          {METHODS.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(m.id)}
                className={[
                  "rounded-xl border px-2 py-3 text-center transition-all",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
                  active
                    ? "border-gold/50 bg-gold/10 shadow-[0_0_16px_var(--gold-glow)]"
                    : "border-border bg-surface-elevated/50 hover:border-cyan/30",
                ].join(" ")}
              >
                <span
                  className={[
                    "block text-sm font-medium",
                    active ? "text-gold" : "text-foreground",
                  ].join(" ")}
                >
                  {m.label}
                </span>
                <span className="mt-1 block text-[10px] text-muted leading-snug">
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-muted leading-relaxed">
          {METHOD_DETAIL[method]}
        </p>
        {method === "time" ? (
          <p className="mt-2 text-[11px] text-gold/90 leading-relaxed border border-gold/25 rounded-lg px-3 py-2 bg-gold/5">
            方法标识：meihua-time-to-najia（梅花先天数 + 纳甲分析混合，非纯纳甲起卦）
          </p>
        ) : null}

        {method === "time" ? (
          <div className="mt-4">
            <Field
              label="起卦时间"
              required
              hint="默认当前时刻；可改历史时间复盘；时区取本机"
            >
              <input
                type="datetime-local"
                className={inputClass}
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {method === "manual" ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted leading-relaxed">
              自下而上指定六爻。点击爻位循环：少阳 → 少阴 → 老阳 → 老阴；也可点下方按钮直接选定。
            </p>
            <div className="rounded-xl border border-border bg-surface/80 p-3 space-y-2">
              {[5, 4, 3, 2, 1, 0].map((idx) => {
                const value = lines[idx]!;
                const pos = (idx + 1) as 1 | 2 | 3 | 4 | 5 | 6;
                return (
                  <div
                    key={pos}
                    className="rounded-lg border border-border/80 bg-surface-elevated/40 p-2"
                  >
                    <button
                      type="button"
                      onClick={() => cycleLine(idx)}
                      className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan rounded-md"
                      aria-label={`${POS_LABEL[pos]}，当前${YAO_LABEL[value]}，点击切换`}
                    >
                      <YaoLine value={value} position={pos} />
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                      {YAO_OPTIONS.map((opt) => {
                        const on = value === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setLineAt(idx, opt)}
                            className={[
                              "h-7 px-2 rounded-md text-[11px] border transition-colors",
                              on
                                ? "border-gold/50 bg-gold/15 text-gold"
                                : "border-border text-muted hover:border-cyan/40 hover:text-cyan",
                            ].join(" ")}
                          >
                            {YAO_LABEL[opt]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {error ? (
        <p className="text-sm text-danger text-center" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        disabled={!canSubmit || busy}
        onClick={handleCast}
      >
        {busy ? "起卦中…" : "起卦"}
      </Button>

      <p className="text-xs text-muted text-center leading-relaxed">
        装卦由本地确定性引擎完成（不经 LLM），结果写入本机存储；解卦报告可另选模板或
        LLM。
      </p>
    </div>
  );
}

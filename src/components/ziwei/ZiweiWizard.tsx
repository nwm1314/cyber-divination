"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Gender } from "@/lib/types";
import type { ZiweiChartInput } from "@/lib/types/ziwei";
import { computeZiweiChart } from "@/lib/ziwei";
import { lunarToSolarDate } from "@/lib/bazi/calendar";
import { saveZiweiChart } from "@/lib/storage";
import { Button, Card } from "@/components/ui";
import {
  Field,
  inputClass,
  StepProgress,
  SolarDateField,
  BirthTimeField,
  RegionSelect,
} from "@/components/form";

const STEPS = ["姓名", "生日", "时辰", "性别地点", "确认"] as const;

type Draft = {
  name: string;
  solarDate: string;
  lunarDate: string;
  isLeapMonth: boolean;
  birthTime: string;
  shichenBranch: string;
  shichenUnknown: boolean;
  gender: Gender | "";
  province: string;
  city: string;
  lng: string;
};

function emptyDraft(): Draft {
  return {
    name: "",
    solarDate: "",
    lunarDate: "",
    isLeapMonth: false,
    birthTime: "",
    shichenBranch: "",
    shichenUnknown: false,
    gender: "",
    province: "",
    city: "",
    lng: "",
  };
}

function resolveSolarDate(draft: Draft): string {
  if (draft.solarDate) return draft.solarDate;
  if (draft.lunarDate.trim()) {
    return lunarToSolarDate(draft.lunarDate.trim(), draft.isLeapMonth);
  }
  throw new Error("请填写阳历或农历生日");
}

const BRANCH_MID: Record<string, string> = {
  子: "00:00",
  丑: "02:00",
  寅: "04:00",
  卯: "06:00",
  辰: "08:00",
  巳: "10:00",
  午: "12:00",
  未: "14:00",
  申: "16:00",
  酉: "18:00",
  戌: "20:00",
  亥: "22:00",
};

function toInput(draft: Draft): ZiweiChartInput {
  const solarDate = resolveSolarDate(draft);
  let birthTime: string | undefined;
  if (!draft.shichenUnknown) {
    if (draft.birthTime.trim()) birthTime = draft.birthTime.trim();
    else if (draft.shichenBranch && BRANCH_MID[draft.shichenBranch]) {
      birthTime = BRANCH_MID[draft.shichenBranch];
    }
  }
  const shichenUnknown =
    draft.shichenUnknown || (!birthTime && !draft.shichenBranch);

  const lngNum = draft.lng.trim() ? Number(draft.lng) : undefined;
  const place =
    draft.province || draft.city || (lngNum != null && Number.isFinite(lngNum))
      ? {
          province: draft.province.trim(),
          city: draft.city.trim(),
          lng: lngNum != null && Number.isFinite(lngNum) ? lngNum : undefined,
        }
      : undefined;

  return {
    solarDate,
    lunarDate: draft.lunarDate.trim() || undefined,
    isLeapMonth: draft.isLeapMonth ? true : undefined,
    birthTime: shichenUnknown ? undefined : birthTime,
    shichenUnknown: shichenUnknown || undefined,
    gender: draft.gender as Gender,
    birthPlace: place,
    name: draft.name.trim() || undefined,
  };
}

export function ZiweiWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!draft.name.trim()) e.name = "请填写姓名";
    }
    if (s === 1) {
      if (!draft.solarDate && !draft.lunarDate.trim()) {
        e.date = "阳历或农历至少填写其一";
      } else if (
        draft.solarDate &&
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.solarDate)
      ) {
        e.date = "阳历请写成 YYYY-MM-DD，如 1990-05-15";
      } else if (!draft.solarDate && draft.lunarDate.trim()) {
        try {
          lunarToSolarDate(draft.lunarDate.trim(), draft.isLeapMonth);
        } catch {
          e.date = "农历格式应为 YYYY-M-D";
        }
      }
    }
    if (
      s === 1 &&
      draft.solarDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(draft.solarDate)
    ) {
      const [y, mo, d] = draft.solarDate.split("-").map(Number);
      const dt = new Date(y, mo - 1, d);
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== mo - 1 ||
        dt.getDate() !== d
      ) {
        e.date = "阳历日期无效，请检查年月日";
      }
    }
    if (s === 2 && !draft.shichenUnknown && draft.birthTime) {
      if (!/^\d{1,2}:\d{2}$/.test(draft.birthTime)) {
        e.time = "时间请写成 HH:mm，如 14:30";
      } else {
        const [hh, mm] = draft.birthTime.split(":").map(Number);
        if (hh > 23 || mm > 59) e.time = "时间超出范围（00:00–23:59）";
      }
    }
    if (s === 3) {
      if (!draft.gender) e.gender = "请选择性别";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((x) => Math.min(x + 1, STEPS.length - 1));
  };

  const back = () => {
    setErrors({});
    if (step === 0) return;
    setStep((x) => x - 1);
  };

  const submitAndChart = () => {
    for (const s of [0, 1, 3]) {
      if (!validate(s)) {
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input = toInput(draft);
      const chart = computeZiweiChart(input);
      saveZiweiChart(chart, { solarDate: input.solarDate });
      void import("@/lib/storage/mode").then(({ canUseCloudAndShare }) => {
        if (!canUseCloudAndShare()) return;
        void import("@/lib/storage/sync").then(({ pushOneZiwei }) =>
          pushOneZiwei({ chart, solarDate: input.solarDate }).catch(
            () => undefined,
          ),
        );
      });
      router.push(`/ziwei/${chart.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "排盘失败");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <StepProgress current={step} total={STEPS.length} labels={[...STEPS]} />
      <Card glow={step === STEPS.length - 1 ? "cyan" : "none"}>
        {step === 0 && (
          <div className="space-y-4">
            <Field label="姓名" required error={errors.name}>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="用于展示与称呼"
                autoComplete="name"
              />
            </Field>
            <p className="text-xs text-muted leading-relaxed">
              紫微排盘复用生辰字段。确认后由本地确定性引擎排盘（不经
              LLM）；解读报告可另选模板或 LLM。
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              阳历或农历至少填其一。阳历支持直接输入（如 1990-05-15）或点「日历」。
            </p>
            {errors.date ? (
              <p className="text-xs text-danger">{errors.date}</p>
            ) : null}
            <SolarDateField
              label="阳历生日"
              value={draft.solarDate}
              onChange={(solarDate) => patch({ solarDate })}
              error={
                errors.date && !draft.lunarDate.trim() ? errors.date : undefined
              }
            />
            <Field
              label="农历生日"
              hint="可选；格式 1990-8-15，仅填农历时将自动换算阳历"
            >
              <input
                className={inputClass}
                value={draft.lunarDate}
                onChange={(e) => patch({ lunarDate: e.target.value })}
                placeholder="年-月-日，如 1990-8-15"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isLeapMonth}
                onChange={(e) => patch({ isLeapMonth: e.target.checked })}
                className="accent-cyan size-4"
                aria-label="农历闰月"
              />
              农历闰月
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              时辰影响命宫与身宫；记不清可勾选未知（默认午时估算，结果仅供参考）。
            </p>
            <BirthTimeField
              label="出生时间"
              value={draft.birthTime}
              disabled={draft.shichenUnknown}
              error={errors.time}
              onChange={(birthTime) =>
                patch({ birthTime, shichenBranch: "" })
              }
            />
            <div>
              <p className="text-xs text-muted mb-2" id="zw-shichen-hint">
                或按时辰选择：
              </p>
              <div
                className="grid grid-cols-4 sm:grid-cols-6 gap-1.5"
                role="group"
                aria-labelledby="zw-shichen-hint"
              >
                {(
                  [
                    ["子", "23–1"],
                    ["丑", "1–3"],
                    ["寅", "3–5"],
                    ["卯", "5–7"],
                    ["辰", "7–9"],
                    ["巳", "9–11"],
                    ["午", "11–13"],
                    ["未", "13–15"],
                    ["申", "15–17"],
                    ["酉", "17–19"],
                    ["戌", "19–21"],
                    ["亥", "21–23"],
                  ] as const
                ).map(([b, range]) => (
                  <button
                    key={b}
                    type="button"
                    disabled={draft.shichenUnknown}
                    aria-pressed={draft.shichenBranch === b}
                    aria-label={`${b}时 ${range}点`}
                    onClick={() =>
                      patch({
                        shichenBranch: b,
                        birthTime: "",
                        shichenUnknown: false,
                      })
                    }
                    className={[
                      "rounded-md border px-1 py-1.5 text-center text-xs transition-colors disabled:opacity-40",
                      draft.shichenBranch === b
                        ? "border-cyan bg-cyan/15 text-cyan"
                        : "border-border bg-surface-elevated text-muted hover:border-cyan/40",
                    ].join(" ")}
                  >
                    <span className="font-medium text-foreground">{b}</span>
                    <span className="block text-[9px] opacity-70">{range}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.shichenUnknown}
                onChange={(e) =>
                  patch({
                    shichenUnknown: e.target.checked,
                    birthTime: e.target.checked ? "" : draft.birthTime,
                    shichenBranch: e.target.checked ? "" : draft.shichenBranch,
                  })
                }
                className="accent-cyan size-4"
                aria-label="时辰未知"
              />
              时辰未知
            </label>
            {!draft.shichenUnknown &&
            !draft.birthTime.trim() &&
            !draft.shichenBranch ? (
              <p className="text-xs text-gold/90">
                未填时间/时辰将按「未知」处理。
              </p>
            ) : null}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Field label="性别" required error={errors.gender}>
              <div className="flex gap-3" role="group" aria-label="性别">
                {(
                  [
                    ["male", "男"],
                    ["female", "女"],
                  ] as const
                ).map(([v, lab]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={draft.gender === v}
                    aria-label={lab}
                    onClick={() => patch({ gender: v })}
                    className={[
                      "flex-1 h-11 rounded-lg border transition-colors",
                      draft.gender === v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-surface-elevated text-muted hover:border-cyan/40",
                    ].join(" ")}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </Field>
            <RegionSelect
              province={draft.province}
              city={draft.city}
              lng={draft.lng}
              onChange={(next) => patch(next)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <p className="text-muted mb-2">请核对以下信息，可返回修改</p>
            {(
              [
                ["姓名", draft.name || "—", 0],
                ["阳历", draft.solarDate || "—", 1],
                [
                  "农历",
                  draft.lunarDate
                    ? `${draft.lunarDate}${draft.isLeapMonth ? "（闰）" : ""}`
                    : "—",
                  1,
                ],
                [
                  "时辰",
                  draft.shichenUnknown
                    ? "未知"
                    : draft.birthTime ||
                      (draft.shichenBranch
                        ? `${draft.shichenBranch}时`
                        : "未知"),
                  2,
                ],
                [
                  "性别",
                  draft.gender === "male"
                    ? "男"
                    : draft.gender === "female"
                      ? "女"
                      : "—",
                  3,
                ],
                [
                  "地点",
                  [draft.province, draft.city].filter(Boolean).join(" ") || "—",
                  3,
                ],
              ] as const
            ).map(([k, v, editStep]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2 border-b border-border/50 py-2"
              >
                <span className="text-muted">{k}</span>
                <span className="text-foreground flex-1 text-right">{v}</span>
                <button
                  type="button"
                  className="text-xs text-cyan shrink-0"
                  onClick={() => setStep(editStep)}
                  aria-label={`修改${k}`}
                >
                  改
                </button>
              </div>
            ))}
            {submitError ? (
              <p className="text-xs text-danger">{submitError}</p>
            ) : null}
          </div>
        )}

        <div
          className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between"
          role="group"
          aria-label="步骤导航"
        >
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            aria-label="上一步"
          >
            上一步
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} aria-label="下一步">
              下一步
            </Button>
          ) : (
            <Button
              onClick={submitAndChart}
              disabled={submitting}
              aria-label={submitting ? "排盘中" : "确认并排紫微盘"}
              aria-busy={submitting || undefined}
            >
              {submitting ? "排盘中…" : "确认并排紫微盘"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

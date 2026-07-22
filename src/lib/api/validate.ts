import type {
  BaziChart,
  LiuyaoChart,
  ViewMode,
  YaoValue,
  ZiweiChart,
} from "@/lib/types";
import { baziChartMinSchema } from "@/lib/contracts/charts";

const MAX_BODY_BYTES = 200_000;

export function checkBodySize(raw: string): string | null {
  if (raw.length > MAX_BODY_BYTES) {
    return `请求体过大（>${MAX_BODY_BYTES} 字节）`;
  }
  return null;
}

export function validateChartPayload(
  chart: unknown,
): { ok: true; chart: BaziChart } | { ok: false; message: string } {
  if (!chart || typeof chart !== "object") {
    return { ok: false, message: "缺少命盘对象" };
  }
  // 先跑 zod 最小契约，再保留字段级中文错误
  const zod = baziChartMinSchema.safeParse(chart);
  if (!zod.success) {
    const c = chart as Partial<BaziChart>;
    if (!c.pillars?.day?.stem || !c.pillars?.day?.branch) {
      return { ok: false, message: "缺少有效日柱" };
    }
    if (!c.dayMaster || typeof c.dayMaster !== "string") {
      return { ok: false, message: "缺少日主" };
    }
    if (!c.profileId || typeof c.profileId !== "string") {
      return { ok: false, message: "缺少 profileId" };
    }
    if (!c.wuxingScores || typeof c.wuxingScores !== "object") {
      return { ok: false, message: "缺少五行分数" };
    }
    if (!Array.isArray(c.dayun) || !Array.isArray(c.liunian)) {
      return { ok: false, message: "大运/流年结构无效" };
    }
    if (
      (Array.isArray(c.dayun) && c.dayun.length > 20) ||
      (Array.isArray(c.liunian) && c.liunian.length > 20)
    ) {
      return { ok: false, message: "大运/流年条目过多" };
    }
    const first = zod.error.issues[0];
    return {
      ok: false,
      message: first?.message ?? "命盘结构无效",
    };
  }
  const c = chart as Partial<BaziChart>;
  if (c.dayun && c.dayun.length > 20) {
    return { ok: false, message: "大运/流年条目过多" };
  }
  if (c.liunian && c.liunian.length > 20) {
    return { ok: false, message: "大运/流年条目过多" };
  }
  return { ok: true, chart: c as BaziChart };
}

/** 紫微盘校验（T104；最小字段，兼容 fixture） */
export function validateZiweiChartPayload(
  chart: unknown,
): { ok: true; chart: ZiweiChart } | { ok: false; message: string } {
  if (!chart || typeof chart !== "object") {
    return { ok: false, message: "缺少紫微命盘对象" };
  }
  const c = chart as Partial<ZiweiChart>;
  if (!c.id || typeof c.id !== "string") {
    return { ok: false, message: "缺少 chart.id" };
  }
  if (!c.mingGong || typeof c.mingGong !== "string") {
    return { ok: false, message: "缺少命宫 mingGong" };
  }
  if (!c.shenGong || typeof c.shenGong !== "string") {
    return { ok: false, message: "缺少身宫 shenGong" };
  }
  if (!Array.isArray(c.palaces) || c.palaces.length === 0) {
    return { ok: false, message: "缺少十二宫 palaces" };
  }
  if (c.palaces.length > 12) {
    return { ok: false, message: "宫位条目过多" };
  }
  if (!c.majorStars || typeof c.majorStars !== "object") {
    return { ok: false, message: "缺少 majorStars" };
  }
  if (!Array.isArray(c.daxian)) {
    return { ok: false, message: "大限 daxian 结构无效" };
  }
  if (c.daxian.length > 20) {
    return { ok: false, message: "大限条目过多" };
  }
  if (c.liunian != null && !Array.isArray(c.liunian)) {
    return { ok: false, message: "流年 liunian 结构无效" };
  }
  if (Array.isArray(c.liunian) && c.liunian.length > 30) {
    return { ok: false, message: "流年条目过多" };
  }
  if (!c.meta || typeof c.meta !== "object") {
    return { ok: false, message: "缺少 meta" };
  }
  return { ok: true, chart: c as ZiweiChart };
}

/** 六爻盘校验（T114；最小字段，兼容 fixture / 装卦输出） */
export function validateLiuyaoChartPayload(
  chart: unknown,
): { ok: true; chart: LiuyaoChart } | { ok: false; message: string } {
  if (!chart || typeof chart !== "object") {
    return { ok: false, message: "缺少六爻盘对象" };
  }
  const c = chart as Partial<LiuyaoChart>;
  if (!c.id || typeof c.id !== "string") {
    return { ok: false, message: "缺少 chart.id" };
  }
  if (!c.question || typeof c.question !== "string" || !c.question.trim()) {
    return { ok: false, message: "缺少所问事项 question（一事一问）" };
  }
  if (c.question.length > 500) {
    return { ok: false, message: "所问事项过长" };
  }
  if (
    c.method !== "coins" &&
    c.method !== "time" &&
    c.method !== "manual"
  ) {
    return { ok: false, message: "method 须为 coins|time|manual" };
  }
  if (!Array.isArray(c.lines) || c.lines.length !== 6) {
    return { ok: false, message: "lines 须为长度 6 的爻数组" };
  }
  for (let i = 0; i < 6; i++) {
    const line = c.lines[i] as Partial<LiuyaoChart["lines"][number]> | undefined;
    if (!line || typeof line !== "object") {
      return { ok: false, message: `lines[${i}] 无效` };
    }
    const yao = line.yao;
    if (yao !== 1 && yao !== 2 && yao !== 3 && yao !== 4 && yao !== 5 && yao !== 6) {
      return { ok: false, message: `lines[${i}].yao 须为 1–6` };
    }
    const val = line.value as YaoValue | undefined;
    if (val !== 6 && val !== 7 && val !== 8 && val !== 9) {
      return { ok: false, message: `lines[${i}].value 须为 6|7|8|9` };
    }
  }
  if (!c.benGua || typeof c.benGua !== "object") {
    return { ok: false, message: "缺少本卦 benGua" };
  }
  if (
    typeof c.benGua.name !== "string" ||
    typeof c.benGua.upper !== "string" ||
    typeof c.benGua.lower !== "string"
  ) {
    return { ok: false, message: "benGua 结构无效" };
  }
  if (c.bianGua != null) {
    if (typeof c.bianGua !== "object") {
      return { ok: false, message: "bianGua 结构无效" };
    }
    if (
      typeof c.bianGua.name !== "string" ||
      typeof c.bianGua.upper !== "string" ||
      typeof c.bianGua.lower !== "string"
    ) {
      return { ok: false, message: "bianGua 字段无效" };
    }
  }
  if (typeof c.shiYao !== "number" || typeof c.yingYao !== "number") {
    return { ok: false, message: "缺少 shiYao/yingYao" };
  }
  if (!c.meta || typeof c.meta !== "object") {
    return { ok: false, message: "缺少 meta" };
  }
  return { ok: true, chart: c as LiuyaoChart };
}

export function parseViewMode(v: unknown): ViewMode {
  return v === "pro" ? "pro" : "plain";
}

/** @deprecated 请从 @/lib/api/rate-limit 导入；保留 re-export 避免旧引用断裂 */
export { rateLimit } from "@/lib/api/rate-limit";

/**
 * 起卦方法与流派标识（T280）
 * 时间法 = 梅花先天数 → 再入纳甲，必须独立标识。
 */

import type {
  LiuyaoCastingSchool,
  LiuyaoMethod,
  LiuyaoRandomSource,
} from "@/lib/types/liuyao";

export const CASTING_SCHOOL_BY_METHOD: Readonly<
  Record<LiuyaoMethod, LiuyaoCastingSchool>
> = {
  coins: "najia-coins",
  manual: "najia-manual",
  time: "meihua-time-to-najia",
} as const;

export const METHOD_NOTE: Readonly<Record<LiuyaoMethod, string>> = {
  coins:
    "三钱纳甲六爻：六次掷三钱成六爻，按京房纳甲安世应六亲。",
  manual:
    "手工指定六爻后按纳甲装卦（世应/六亲/用神与铜钱法同一规则层）。",
  time:
    "梅花时间起卦（先天数上下卦+动爻）后再入纳甲六爻分析；非纯三钱纳甲起卦，属混合方法。",
} as const;

export const SCHOOL_LABEL: Readonly<Record<LiuyaoCastingSchool, string>> = {
  "najia-coins": "三钱纳甲",
  "najia-manual": "手工纳甲",
  "meihua-time-to-najia": "梅花时间→纳甲（混合）",
} as const;

export function castingSchoolOf(method: LiuyaoMethod): LiuyaoCastingSchool {
  return CASTING_SCHOOL_BY_METHOD[method];
}

export function methodNoteOf(method: LiuyaoMethod): string {
  return METHOD_NOTE[method];
}

export function randomSourceOf(
  method: LiuyaoMethod,
  opts: { seedProvided?: boolean },
): LiuyaoRandomSource {
  if (method !== "coins") return "none";
  return opts.seedProvided ? "seeded-prng" : "fresh-seed";
}

/** 默认展示时区（浏览器本地由 UI 写入；服务端默认东八区说明） */
export const DEFAULT_CAST_TIMEZONE = "Asia/Shanghai";

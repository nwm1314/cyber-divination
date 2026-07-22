/**
 * 博士十二神安星表（T182 · 三合通行）
 * 以禄存起博士，阳男阴女顺行、阴男阳女逆行。
 * 寅起索引 0=寅 … 11=丑
 */

import type { Dizhi } from "@/lib/types/ziwei";
import type { Tiangan } from "./constants";
import { fixMod, yinIndexFromBranch } from "./constants";
import { LUCUN_BY_YEAR_STEM } from "./aux-stars";

export const BOSHI_TWELVE = [
  "博士",
  "力士",
  "青龙",
  "小耗",
  "将军",
  "奏书",
  "飞廉",
  "喜神",
  "病符",
  "大耗",
  "伏兵",
  "官府",
] as const;

export type BoshiStarName = (typeof BOSHI_TWELVE)[number];

/**
 * 安博士十二神
 * @param yearStem 年干 → 禄存宫
 * @param yearBranch 年支 → 阴阳
 * @param gender male|female
 * @returns 星名 → 寅起索引
 */
export function placeBoshiTwelve(params: {
  yearStem: Tiangan;
  yearBranch: Dizhi;
  gender: "male" | "female";
}): Record<BoshiStarName, number> {
  const lucunBranch = LUCUN_BY_YEAR_STEM[params.yearStem];
  const start = yinIndexFromBranch(lucunBranch);
  const yangYear = "甲丙戊庚壬".includes(params.yearStem);
  // 阳男阴女顺；阴男阳女逆
  const forward =
    (yangYear && params.gender === "male") ||
    (!yangYear && params.gender === "female");

  const out = {} as Record<BoshiStarName, number>;
  for (let i = 0; i < 12; i++) {
    const yi = forward ? fixMod(start + i) : fixMod(start - i);
    out[BOSHI_TWELVE[i]] = yi;
  }
  return out;
}

export function boshiAtYin(
  placement: Record<BoshiStarName, number>,
  yinIndex: number,
): BoshiStarName[] {
  const names: BoshiStarName[] = [];
  for (const name of BOSHI_TWELVE) {
    if (placement[name] === yinIndex) names.push(name);
  }
  return names;
}

/**
 * 六神（按日干起 · T281 务实版）
 * 初爻起日干对应六神，自下而上顺排。
 * 甲乙→青龙，丙丁→朱雀，戊→勾陈，己→螣蛇，庚辛→白虎，壬癸→玄武。
 */

import type { LiushenName, YaoPosition } from "@/lib/types/liuyao";

export type DayStem =
  | "甲"
  | "乙"
  | "丙"
  | "丁"
  | "戊"
  | "己"
  | "庚"
  | "辛"
  | "壬"
  | "癸";

/** 六神环：自青龙起顺行 */
export const LIUSHEN_ORDER: readonly LiushenName[] = [
  "青龙",
  "朱雀",
  "勾陈",
  "螣蛇",
  "白虎",
  "玄武",
] as const;

/** 日干 → 初爻六神在环中的起点下标 */
export const STEM_LIUSHEN_START: Readonly<Record<DayStem, number>> = {
  甲: 0,
  乙: 0,
  丙: 1,
  丁: 1,
  戊: 2,
  己: 3,
  庚: 4,
  辛: 4,
  壬: 5,
  癸: 5,
} as const;

export function isDayStem(s: string): s is DayStem {
  return s in STEM_LIUSHEN_START;
}

/** 由日干取六爻六神（下标 0=初爻 … 5=上爻） */
export function assignLiushen(dayStem: string): LiushenName[] {
  if (!isDayStem(dayStem)) {
    throw new Error(`非法日干: ${dayStem}`);
  }
  const start = STEM_LIUSHEN_START[dayStem];
  return LIUSHEN_ORDER.map((_, i) => LIUSHEN_ORDER[(start + i) % 6]!);
}

export type YaoLiushen = {
  yao: YaoPosition;
  liushen: LiushenName;
};

export function assignLiushenRows(dayStem: string): YaoLiushen[] {
  return assignLiushen(dayStem).map((liushen, i) => ({
    yao: (i + 1) as YaoPosition,
    liushen,
  }));
}

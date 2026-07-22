/**
 * 飞星飞宫标记约定（T190）
 * 四化目标星表与 SIHUA_BY_YEAR_STEM 同源（宫干=年干同表）。
 */

import type { SihuaKind } from "./sihua";

/** 飞入星上的标记：源宫名·化X（例：命宫·化禄） */
export function feixingMark(fromPalace: string, kind: SihuaKind): string {
  return `${fromPalace}·化${kind}`;
}

export function isFeixingMark(s: string): boolean {
  return s.includes("·化");
}

export const FLAG_FEIXING_FLIGHTS = "feixing_palace_flights" as const;

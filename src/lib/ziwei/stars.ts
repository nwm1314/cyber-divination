/**
 * 十四主星安星（三合派表驱动）
 */

import type { Dizhi, ZiweiStar } from "@/lib/types/ziwei";
import {
  TIANFU_SERIES,
  ZIWEI_SERIES,
  branchFromYinIndex,
  fixMod,
  type MajorStarName,
} from "./tables/constants";

export type MajorStarPlacement = {
  /** 星名 → 寅起宫位索引 */
  starYinIndex: Record<MajorStarName, number>;
  /** 星名 → 地支 */
  starBranch: Record<MajorStarName, Dizhi>;
  ziweiYinIndex: number;
  tianfuYinIndex: number;
};

/**
 * 起紫微（农历日 + 五行局数）
 *
 * 口诀大意：局数除日数，商数宫前走；有余加数奇逆偶顺。
 * 天府在紫微对宫（寅起索引：tianfu = 12 - ziwei，寅上同宫时均为 0）
 */
export function locateZiweiTianfu(
  lunarDay: number,
  juValue: number,
): { ziweiYinIndex: number; tianfuYinIndex: number } {
  if (lunarDay < 1 || lunarDay > 30) {
    throw new Error(`invalid lunarDay: ${lunarDay}`);
  }
  if (juValue < 2 || juValue > 6) {
    throw new Error(`invalid juValue: ${juValue}`);
  }

  let offset = -1;
  let quotient = 0;
  let remainder = -1;
  do {
    offset++;
    const divisor = lunarDay + offset;
    quotient = Math.floor(divisor / juValue);
    remainder = divisor % juValue;
  } while (remainder !== 0);

  quotient %= 12;
  let ziweiIndex = quotient - 1;
  if (offset % 2 === 0) {
    ziweiIndex += offset;
  } else {
    ziweiIndex -= offset;
  }
  ziweiIndex = fixMod(ziweiIndex);
  const tianfuIndex = fixMod(12 - ziweiIndex);
  return { ziweiYinIndex: ziweiIndex, tianfuYinIndex: tianfuIndex };
}

/** 安紫微星系 + 天府星系 */
export function placeMajorStars(
  lunarDay: number,
  juValue: number,
): MajorStarPlacement {
  const { ziweiYinIndex, tianfuYinIndex } = locateZiweiTianfu(
    lunarDay,
    juValue,
  );

  const starYinIndex = {} as Record<MajorStarName, number>;
  const starBranch = {} as Record<MajorStarName, Dizhi>;

  ZIWEI_SERIES.forEach((name, i) => {
    if (!name) return;
    const yi = fixMod(ziweiYinIndex - i);
    starYinIndex[name] = yi;
    starBranch[name] = branchFromYinIndex(yi);
  });

  TIANFU_SERIES.forEach((name, i) => {
    if (!name) return;
    const yi = fixMod(tianfuYinIndex + i);
    starYinIndex[name] = yi;
    starBranch[name] = branchFromYinIndex(yi);
  });

  return {
    starYinIndex,
    starBranch,
    ziweiYinIndex,
    tianfuYinIndex,
  };
}

export function majorStarAtYin(
  placement: MajorStarPlacement,
  yinIndex: number,
): ZiweiStar[] {
  const stars: ZiweiStar[] = [];
  for (const [name, yi] of Object.entries(placement.starYinIndex)) {
    if (yi === yinIndex) {
      stars.push({ name, category: "major" });
    }
  }
  // 稳定顺序：按十四主星常序
  const order = [
    "紫微",
    "天机",
    "太阳",
    "武曲",
    "天同",
    "廉贞",
    "天府",
    "太阴",
    "贪狼",
    "巨门",
    "天相",
    "天梁",
    "七杀",
    "破军",
  ];
  stars.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return stars;
}

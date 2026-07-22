/**
 * 命宫、身宫、十二宫、五行局、宫干（五虎遁）
 */

import type { Dizhi, ZiweiPalace, ZiweiPalaceName } from "@/lib/types/ziwei";
import type { Tiangan, WuxingJuName } from "./tables/constants";
import {
  NAYIN_DIFF_TO_JU,
  PALACE_NAMES,
  TIANGAN_LIST,
  WUHU_YIN_STEM,
  branchFromYinIndex,
  branchNayinNumber,
  fixMod,
  hourIndexFromBranch,
  stemNayinNumber,
  yinIndexFromBranch,
} from "./tables/constants";

export type MingShenResult = {
  /** 寅起索引 */
  mingYinIndex: number;
  shenYinIndex: number;
  mingBranch: Dizhi;
  shenBranch: Dizhi;
  mingStem: Tiangan;
  /** 命宫宫名恒为命宫 */
  mingGong: ZiweiPalaceName;
  /** 身宫所在宫名 */
  shenGong: ZiweiPalaceName;
  wuxingJu: WuxingJuName;
  juValue: number;
};

/**
 * 安命身宫
 * 寅起正月，顺数至生月；逆数生时为命宫；顺数生时为身宫
 * month 1–12；时支子=0
 */
export function placeMingShen(
  lunarMonth: number,
  hourBranch: Dizhi,
  yearStem: Tiangan,
): MingShenResult {
  if (lunarMonth < 1 || lunarMonth > 12) {
    throw new Error(`invalid lunarMonth: ${lunarMonth}`);
  }
  const monthIndex = lunarMonth - 1; // 正月=寅=0
  const hIdx = hourIndexFromBranch(hourBranch);
  const mingYinIndex = fixMod(monthIndex - hIdx);
  const shenYinIndex = fixMod(monthIndex + hIdx);
  const mingBranch = branchFromYinIndex(mingYinIndex);
  const shenBranch = branchFromYinIndex(shenYinIndex);

  // 五虎遁宫干
  const yinStem = WUHU_YIN_STEM[yearStem];
  const mingStem =
    TIANGAN_LIST[fixMod(TIANGAN_LIST.indexOf(yinStem) + mingYinIndex, 10)];

  const wuxingJu = fiveElementsClass(mingStem, mingBranch);
  const juValue = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 }[
    wuxingJu
  ];

  // 身宫宫名：相对命宫逆布序
  const shenNameIndex = fixMod(mingYinIndex - shenYinIndex);
  const shenGong = PALACE_NAMES[shenNameIndex];

  return {
    mingYinIndex,
    shenYinIndex,
    mingBranch,
    shenBranch,
    mingStem,
    mingGong: "命宫",
    shenGong,
    wuxingJu,
    juValue,
  };
}

/**
 * 定五行局（命宫干支纳音）
 * 干支取数相加，过五减五：1木三 2金四 3水二 4火六 5土五
 */
export function fiveElementsClass(
  stem: Tiangan,
  branch: Dizhi,
): WuxingJuName {
  let idx = stemNayinNumber(stem) + branchNayinNumber(branch);
  while (idx > 5) idx -= 5;
  const ju = NAYIN_DIFF_TO_JU[idx];
  if (!ju) throw new Error(`invalid nayin diff: ${idx}`);
  return ju;
}

/**
 * 自命宫逆布十二宫；顺序按 PALACE_NAMES
 * 宫干：五虎遁自寅起顺填
 */
export function buildTwelvePalaces(
  mingYinIndex: number,
  shenYinIndex: number,
  yearStem: Tiangan,
): ZiweiPalace[] {
  const yinStem = WUHU_YIN_STEM[yearStem];
  const yinStemIdx = TIANGAN_LIST.indexOf(yinStem);

  const palaces: ZiweiPalace[] = [];
  for (let nameIdx = 0; nameIdx < 12; nameIdx++) {
    // 命宫在 mingYinIndex；兄弟在 mingYinIndex-1 …
    const yinIndex = fixMod(mingYinIndex - nameIdx);
    const branch = branchFromYinIndex(yinIndex);
    const stem =
      TIANGAN_LIST[fixMod(yinStemIdx + yinIndex, 10)];
    const name = PALACE_NAMES[nameIdx];
    palaces.push({
      name,
      branch,
      stem,
      stars: [],
      isShenGong: yinIndex === shenYinIndex,
    });
  }
  return palaces;
}

/** 宫名 → 地支（由已建十二宫） */
export function palaceBranchMap(
  palaces: ZiweiPalace[],
): Record<ZiweiPalaceName, Dizhi> {
  const m = {} as Record<ZiweiPalaceName, Dizhi>;
  for (const p of palaces) m[p.name] = p.branch;
  return m;
}

export function palaceNameAtYinIndex(
  mingYinIndex: number,
  yinIndex: number,
): ZiweiPalaceName {
  return PALACE_NAMES[fixMod(mingYinIndex - yinIndex)];
}

export function yinIndexOfPalace(
  mingYinIndex: number,
  name: ZiweiPalaceName,
): number {
  const nameIdx = PALACE_NAMES.indexOf(name);
  return fixMod(mingYinIndex - nameIdx);
}

export { yinIndexFromBranch, branchFromYinIndex };

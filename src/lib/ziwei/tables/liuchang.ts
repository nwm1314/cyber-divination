/**
 * 流昌 / 流曲 / 截空（T191 · T192）
 *
 * 流昌流曲：以「流年年支」为子时，按本命文昌文曲同一安法（戌起逆昌、辰起顺曲）。
 * 本命盘默认用 **生年年支** 安「年流昌/年流曲」；流年条可再叠当年支。
 *
 * 截空：年干 → 空亡两宫（与六爻旬空不同体系；紫微截空通行表）。
 */

import type { Dizhi } from "@/lib/types/ziwei";
import type { Tiangan } from "./constants";
import { fixMod, hourIndexFromBranch, yinIndexFromBranch } from "./constants";

/** 年干 → 截空两地支（通行：甲己申酉、乙庚午未、丙辛辰巳、丁壬寅卯、戊癸子丑） */
export const JIEKONG_BY_YEAR_STEM: Readonly<
  Record<Tiangan, readonly [Dizhi, Dizhi]>
> = {
  甲: ["申", "酉"],
  己: ["申", "酉"],
  乙: ["午", "未"],
  庚: ["午", "未"],
  丙: ["辰", "巳"],
  辛: ["辰", "巳"],
  丁: ["寅", "卯"],
  壬: ["寅", "卯"],
  戊: ["子", "丑"],
  癸: ["子", "丑"],
};

/**
 * 流昌/流曲：把「年支」视作时支索引，同本命昌曲公式
 * 昌：戌起子时逆；曲：辰起子时顺
 */
export function liuChangQuByYearBranch(yearBranch: Dizhi): {
  liuChang: number;
  liuQu: number;
} {
  const h = hourIndexFromBranch(yearBranch);
  return {
    liuChang: fixMod(yinIndexFromBranch("戌") - h),
    liuQu: fixMod(yinIndexFromBranch("辰") + h),
  };
}

export function jiekongYinIndices(yearStem: Tiangan): [number, number] {
  const pair = JIEKONG_BY_YEAR_STEM[yearStem];
  return [yinIndexFromBranch(pair[0]), yinIndexFromBranch(pair[1])];
}

export type MiscAuxName = "流昌" | "流曲" | "截空";

export const MISC_AUX_CATEGORY = {
  流昌: "soft" as const,
  流曲: "soft" as const,
  截空: "harsh" as const,
};

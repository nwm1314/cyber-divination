/**
 * 八卦经卦表
 * 来源：周易八卦通行结构；阴阳编码自下而上（1=阳，0=阴）
 */

import type { TrigramName } from "@/lib/types/liuyao";

export type TrigramEntry = {
  name: TrigramName;
  /** 象：天/地/雷/风/水/火/山/泽 */
  nature: string;
  /** 自下而上三爻：1=阳 0=阴 */
  binary: readonly [0 | 1, 0 | 1, 0 | 1];
};

/** 八卦（先天/后天共用经卦名与爻象） */
export const TRIGRAMS: readonly TrigramEntry[] = [
  { name: "乾", nature: "天", binary: [1, 1, 1] },
  { name: "兑", nature: "泽", binary: [1, 1, 0] },
  { name: "离", nature: "火", binary: [1, 0, 1] },
  { name: "震", nature: "雷", binary: [1, 0, 0] },
  { name: "巽", nature: "风", binary: [0, 1, 1] },
  { name: "坎", nature: "水", binary: [0, 1, 0] },
  { name: "艮", nature: "山", binary: [0, 0, 1] },
  { name: "坤", nature: "地", binary: [0, 0, 0] },
] as const;

export const TRIGRAM_BY_NAME: Readonly<Record<TrigramName, TrigramEntry>> =
  Object.fromEntries(TRIGRAMS.map((t) => [t.name, t])) as Record<
    TrigramName,
    TrigramEntry
  >;

/** binary 键 "111" → 乾 */
export const TRIGRAM_BY_BINARY: Readonly<Record<string, TrigramEntry>> =
  Object.fromEntries(TRIGRAMS.map((t) => [t.binary.join(""), t]));

export function getTrigram(name: TrigramName): TrigramEntry {
  return TRIGRAM_BY_NAME[name];
}

export function getTrigramByBinary(
  b0: 0 | 1,
  b1: 0 | 1,
  b2: 0 | 1,
): TrigramEntry | undefined {
  return TRIGRAM_BY_BINARY[`${b0}${b1}${b2}`];
}

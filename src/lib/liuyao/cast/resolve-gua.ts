import type { GuaRef, TrigramName } from "@/lib/types/liuyao";
import {
  getTrigramByBinary,
  type TrigramEntry,
} from "@/lib/liuyao/data/trigrams";
import { getHexagramByBinary } from "@/lib/liuyao/data/hexagrams";

type Binary6 = readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];

/** 纯卦「X为Y」（表未命中时的兜底） */
const PURE_NAME: Record<TrigramName, string> = {
  乾: "乾为天",
  坤: "坤为地",
  震: "震为雷",
  巽: "巽为风",
  坎: "坎为水",
  离: "离为火",
  艮: "艮为山",
  兑: "兑为泽",
};

/**
 * 可选覆盖查表（测试用）。默认走 HEXAGRAM_BY_BINARY 全名。
 */
type HexLookup = (binaryKey: string) => { name: string } | undefined;

let hexLookup: HexLookup | undefined;

export function setHexagramLookup(fn: HexLookup | undefined): void {
  hexLookup = fn;
}

function fallbackName(upper: TrigramEntry, lower: TrigramEntry): string {
  if (upper.name === lower.name) {
    return PURE_NAME[upper.name];
  }
  return `${upper.nature}${lower.nature}`;
}

export function resolveGuaRef(binary: Binary6): GuaRef {
  const lower = getTrigramByBinary(binary[0], binary[1], binary[2]);
  const upper = getTrigramByBinary(binary[3], binary[4], binary[5]);
  if (!lower || !upper) {
    throw new Error(`无法解析经卦 binary=${binary.join("")}`);
  }

  const key = binary.join("");
  const fromOverride = hexLookup?.(key);
  const fromTable = getHexagramByBinary(key);
  const name =
    fromOverride?.name ?? fromTable?.name ?? fallbackName(upper, lower);

  return {
    name,
    upper: upper.name,
    lower: lower.name,
  };
}

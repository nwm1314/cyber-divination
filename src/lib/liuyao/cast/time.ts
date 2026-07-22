import type { YaoValue } from "@/lib/types/liuyao";
import {
  getTrigram,
  type TrigramEntry,
} from "@/lib/liuyao/data/trigrams";
import type { TrigramName } from "@/lib/types/liuyao";

/**
 * 梅花易数序：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
 * （与先天八卦数一致，%8 时 0 作 8）
 */
const MEIHUA_ORDER: readonly TrigramName[] = [
  "乾",
  "兑",
  "离",
  "震",
  "巽",
  "坎",
  "艮",
  "坤",
];

export type TimeCastParts = {
  /** 公元年 */
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0–23，按小时映射地支时辰 */
  hour: number;
};

/** 时辰 1–12：子=1 … 亥=12（23–1 点子） */
export function hourToShichen(hour: number): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h === 23 || h === 0) return 1;
  return Math.floor((h + 1) / 2) + 1;
}

/** 年支序 1–12：子年=1（以 year % 12 映射，公元年余 4 为子） */
export function yearBranchNum(year: number): number {
  const y = Math.floor(year);
  return ((((y - 4) % 12) + 12) % 12) + 1;
}

function meihuaIndex(sum: number): number {
  const m = sum % 8;
  return m === 0 ? 8 : m;
}

function trigramByMeihua(n: number): TrigramEntry {
  const name = MEIHUA_ORDER[n - 1]!;
  return getTrigram(name);
}

function bitsToStaticYao(bit: 0 | 1): YaoValue {
  return bit === 1 ? 7 : 8;
}

/**
 * 时间起卦（梅花数）：上下卦 + 一位动爻。
 * 上卦=(年支+月+日)%8，下卦=(年支+月+日+时)%8，动爻=(年支+月+日+时)%6（0→6）。
 */
export function castTimeLines(parts: TimeCastParts): YaoValue[] {
  const y = yearBranchNum(parts.year);
  const m = Math.floor(parts.month);
  const d = Math.floor(parts.day);
  const h = hourToShichen(parts.hour);

  if (m < 1 || m > 12) throw new Error(`非法月份 ${parts.month}`);
  if (d < 1 || d > 31) throw new Error(`非法日 ${parts.day}`);

  const upperN = meihuaIndex(y + m + d);
  const lowerN = meihuaIndex(y + m + d + h);
  const movingRaw = (y + m + d + h) % 6;
  const movingYao = movingRaw === 0 ? 6 : movingRaw;

  const upper = trigramByMeihua(upperN);
  const lower = trigramByMeihua(lowerN);

  const values: YaoValue[] = [
    bitsToStaticYao(lower.binary[0]),
    bitsToStaticYao(lower.binary[1]),
    bitsToStaticYao(lower.binary[2]),
    bitsToStaticYao(upper.binary[0]),
    bitsToStaticYao(upper.binary[1]),
    bitsToStaticYao(upper.binary[2]),
  ];

  const idx = movingYao - 1;
  const cur = values[idx]!;
  values[idx] = cur === 7 ? 9 : 6;

  return values;
}

/** 解析 ISO / `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` */
export function parseDateTime(input: string): TimeCastParts {
  const s = input.trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2}))?(?::\d{2})?)?/,
  );
  if (!m) {
    throw new Error(`无法解析时间: ${input}`);
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] != null ? Number(m[4]) : 0,
  };
}

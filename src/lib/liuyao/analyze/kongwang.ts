/**
 * 日旬空亡（T180）
 * 甲子旬空戌亥 … 甲戌旬空申酉 … 通行六十甲子旬空表
 */

export type Dizhi12 =
  | "子"
  | "丑"
  | "寅"
  | "卯"
  | "辰"
  | "巳"
  | "午"
  | "未"
  | "申"
  | "酉"
  | "戌"
  | "亥";

export type Tiangan10 =
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

const DIZHI: readonly Dizhi12[] = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
];

const TIANGAN: readonly Tiangan10[] = [
  "甲",
  "乙",
  "丙",
  "丁",
  "戊",
  "己",
  "庚",
  "辛",
  "壬",
  "癸",
];

/** 旬首（甲X）→ 空亡两支 */
export const XUNKONG_BY_XUN_SHOU: Readonly<
  Record<string, readonly [Dizhi12, Dizhi12]>
> = {
  甲子: ["戌", "亥"],
  甲戌: ["申", "酉"],
  甲申: ["午", "未"],
  甲午: ["辰", "巳"],
  甲辰: ["寅", "卯"],
  甲寅: ["子", "丑"],
};

/** 日干支 → 旬首干支 */
export function xunShouOfDay(dayGanZhi: string): string {
  const stem = dayGanZhi[0] as Tiangan10;
  const branch = dayGanZhi[1] as Dizhi12;
  const si = TIANGAN.indexOf(stem);
  const bi = DIZHI.indexOf(branch);
  if (si < 0 || bi < 0) throw new Error(`invalid dayGanZhi: ${dayGanZhi}`);
  // 旬内序：甲=0 … 癸=9；旬首支 = 日支 - 干序
  const shouBi = ((bi - si) % 12 + 12) % 12;
  return `甲${DIZHI[shouBi]}`;
}

/** 日干支 → 空亡两支 */
export function xunKongOfDay(
  dayGanZhi: string,
): readonly [Dizhi12, Dizhi12] {
  const shou = xunShouOfDay(dayGanZhi);
  const pair = XUNKONG_BY_XUN_SHOU[shou];
  if (!pair) throw new Error(`unknown xun shou: ${shou}`);
  return pair;
}

/** 某地支是否落空 */
export function isBranchKong(
  branch: string | undefined,
  xunKong: readonly [string, string] | undefined,
): boolean {
  if (!branch || !xunKong) return false;
  return xunKong[0] === branch || xunKong[1] === branch;
}

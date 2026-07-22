/** 天干地支与时辰表 — 对齐 bazi-skill references */

export const HEAVENLY_STEMS = [
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
] as const;

export const EARTHLY_BRANCHES = [
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
] as const;

export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];

/** 时辰地支与公历时间 [startHour, endHour) — 子时跨日单独处理 */
export const SHICHEN_RANGES: ReadonlyArray<{
  branch: EarthlyBranch;
  startHour: number;
  endHour: number;
}> = [
  { branch: "子", startHour: 23, endHour: 1 },
  { branch: "丑", startHour: 1, endHour: 3 },
  { branch: "寅", startHour: 3, endHour: 5 },
  { branch: "卯", startHour: 5, endHour: 7 },
  { branch: "辰", startHour: 7, endHour: 9 },
  { branch: "巳", startHour: 9, endHour: 11 },
  { branch: "午", startHour: 11, endHour: 13 },
  { branch: "未", startHour: 13, endHour: 15 },
  { branch: "申", startHour: 15, endHour: 17 },
  { branch: "酉", startHour: 17, endHour: 19 },
  { branch: "戌", startHour: 19, endHour: 21 },
  { branch: "亥", startHour: 21, endHour: 23 },
];

/**
 * 五鼠遁：日干 → 子时起干
 * 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
 */
export const WUSHU_ZI_STEM: Record<HeavenlyStem, HeavenlyStem> = {
  甲: "甲",
  己: "甲",
  乙: "丙",
  庚: "丙",
  丙: "戊",
  辛: "戊",
  丁: "庚",
  壬: "庚",
  戊: "壬",
  癸: "壬",
};

export const FLAG_NIGHT_ZI = "night_zi";
export const FLAG_SHICHEN_UNKNOWN = "shichen_unknown";
export const FLAG_LICHUN_NEAR = "lichun_near";
export const FLAG_JIEQI_BOUNDARY = "jieqi_boundary";
export const FLAG_TRUE_SOLAR_NO_LNG = "true_solar_no_lng";
export const FLAG_TRUE_SOLAR_APPLIED = "true_solar_applied";
export const FLAG_TRUE_SOLAR_CROSS_DAY = "true_solar_cross_day";
export const FLAG_DST_NOT_MODELED = "dst_not_modeled";

export const FLAG_LABELS: Record<string, string> = {
  [FLAG_NIGHT_ZI]: "夜子时（日柱按次日）",
  [FLAG_SHICHEN_UNKNOWN]: "时柱未知·六字盘",
  [FLAG_LICHUN_NEAR]: "立春前后，年柱可能交界，请核对",
  [FLAG_JIEQI_BOUNDARY]: "节气交界，月柱可能双解，请核对",
  [FLAG_TRUE_SOLAR_NO_LNG]: "真太阳时已开但未填经度，未校正",
  [FLAG_TRUE_SOLAR_APPLIED]: "已按经度做真太阳时校正",
  [FLAG_TRUE_SOLAR_CROSS_DAY]: "真太阳时跨日，日柱可能与墙钟日不同",
  [FLAG_DST_NOT_MODELED]: "未建模历史夏令时，边界时刻请人工核对",
};

export function labelFlag(flag: string): string {
  return FLAG_LABELS[flag] ?? flag;
}

/**
 * 紫微斗数常量表（三合派 · T101）
 * 索引约定：以寅为 0 顺行（寅卯辰巳午未申酉戌亥子丑）
 */

import type { Dizhi, ZiweiPalaceName } from "@/lib/types/ziwei";

export const ENGINE_VERSION = "0.8.0" as const;
export const SKILL_REF = "ziwei-tables" as const;
/** 数据结构版本（统一引擎信封 · T270） */
export const SCHEMA_VERSION = "1" as const;
/** 规则集版本 */
export const RULE_SET_VERSION = "0.8.0" as const;

/** 主流派：三合盘体 */
export const SCHOOL_CORE = "sanhe" as const;
/** 飞星叠加命名空间（不改安星） */
export const SCHOOL_FEIXING = "feixing" as const;

/**
 * 规则优先级（先 → 后）
 * 事实层以 sanhe.core 为准；飞星仅叠标
 */
export const RULE_PRIORITY = [
  "sanhe.core",
  "sanhe.sihua",
  "sanhe.zihua",
  "feixing.flights",
  "sanhe.daxian",
] as const;

/** 严格虚岁：age = year - birthYear + 1 */
export const AGE_POLICY_XUSUI = "xusui" as const;
export const CALENDAR_POLICY = "lunar_javascript_cny" as const;
export const TIME_POLICY_SHICHEN = "shichen" as const;
export const TIME_POLICY_UNKNOWN_MULTI = "unknown_multi_candidate" as const;

export const FLAG_SHICHEN_MULTI_CANDIDATE = "shichen_multi_candidate";

/** 地支序（子起） */
export const DIZHI_LIST: readonly Dizhi[] = [
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

/** 天干序 */
export const TIANGAN_LIST = [
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

export type Tiangan = (typeof TIANGAN_LIST)[number];

/** 十二宫名常序：自命宫逆布 */
export const PALACE_NAMES: readonly ZiweiPalaceName[] = [
  "命宫",
  "兄弟",
  "夫妻",
  "子女",
  "财帛",
  "疾厄",
  "迁移",
  "交友",
  "官禄",
  "田宅",
  "福德",
  "父母",
] as const;

/** 十四主星 */
export const MAJOR_STARS = [
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
] as const;

export type MajorStarName = (typeof MAJOR_STARS)[number];

/**
 * 紫微星系（自紫微宫逆行）：紫微→天机→(空)→太阳→武曲→天同→(空)→(空)→廉贞
 */
export const ZIWEI_SERIES: readonly (MajorStarName | "")[] = [
  "紫微",
  "天机",
  "",
  "太阳",
  "武曲",
  "天同",
  "",
  "",
  "廉贞",
] as const;

/**
 * 天府星系（自天府宫顺行）：天府→太阴→贪狼→巨门→天相→天梁→七杀→(空×3)→破军
 */
export const TIANFU_SERIES: readonly (MajorStarName | "")[] = [
  "天府",
  "太阴",
  "贪狼",
  "巨门",
  "天相",
  "天梁",
  "七杀",
  "",
  "",
  "",
  "破军",
] as const;

/**
 * 五虎遁：年干 → 寅宫天干
 * 甲己丙作首，乙庚戊为头，丙辛庚寅上，丁壬壬位流，戊癸甲寅求
 */
export const WUHU_YIN_STEM: Record<Tiangan, Tiangan> = {
  甲: "丙",
  己: "丙",
  乙: "戊",
  庚: "戊",
  丙: "庚",
  辛: "庚",
  丁: "壬",
  壬: "壬",
  戊: "甲",
  癸: "甲",
};

/** 五行局名 → 局数 */
export const WUXING_JU_VALUE = {
  水二局: 2,
  木三局: 3,
  金四局: 4,
  土五局: 5,
  火六局: 6,
} as const;

export type WuxingJuName = keyof typeof WUXING_JU_VALUE;

/**
 * 纳音差 → 五行局（差 1..5）
 * 1 木三 2 金四 3 水二 4 火六 5 土五
 */
export const NAYIN_DIFF_TO_JU: Record<number, WuxingJuName> = {
  1: "木三局",
  2: "金四局",
  3: "水二局",
  4: "火六局",
  5: "土五局",
};

/** 天干取数：甲乙1 … 壬癸5 */
export function stemNayinNumber(stem: Tiangan): number {
  return Math.floor(TIANGAN_LIST.indexOf(stem) / 2) + 1;
}

/** 地支取数：子午丑未1，寅申卯酉2，辰戌巳亥3 */
export function branchNayinNumber(branch: Dizhi): number {
  const i = DIZHI_LIST.indexOf(branch);
  return Math.floor(fixMod(i, 6) / 2) + 1;
}

/**
 * 命主（年支）
 * 子贪狼 丑巨门 寅禄存 卯文曲 辰廉贞 巳武曲
 * 午破军 未武曲 申廉贞 酉文曲 戌禄存 亥文曲
 */
export const MING_ZHU_BY_YEAR_BRANCH: Record<Dizhi, string> = {
  子: "贪狼",
  丑: "巨门",
  寅: "禄存",
  卯: "文曲",
  辰: "廉贞",
  巳: "武曲",
  午: "破军",
  未: "武曲",
  申: "廉贞",
  酉: "文曲",
  戌: "禄存",
  亥: "文曲",
};

/**
 * 身主（年支）
 * 子火星 丑天相 寅天梁 卯天同 辰文昌 巳天机
 * 午火星 未天相 申天梁 酉天同 戌文昌 亥天机
 */
export const SHEN_ZHU_BY_YEAR_BRANCH: Record<Dizhi, string> = {
  子: "火星",
  丑: "天相",
  寅: "天梁",
  卯: "天同",
  辰: "文昌",
  巳: "天机",
  午: "火星",
  未: "天相",
  申: "天梁",
  酉: "天同",
  戌: "文昌",
  亥: "天机",
};

export const FLAG_SHICHEN_UNKNOWN = "shichen_unknown";
export const FLAG_NIGHT_ZI = "night_zi";
export const FLAG_LEAP_MONTH = "leap_month";
export const FLAG_DEFAULT_NOON = "default_noon_hour";
/** 闰月按本月序安星，流派或有差异 */
export const FLAG_LEAP_MONTH_AS_SAME = "leap_month_as_same_month";

export function fixMod(n: number, m = 12): number {
  return ((n % m) + m) % m;
}

/** 寅起索引 0..11 → 地支 */
export function branchFromYinIndex(yinIndex: number): Dizhi {
  return DIZHI_LIST[fixMod(yinIndex + 2)];
}

/** 地支 → 寅起索引 */
export function yinIndexFromBranch(branch: Dizhi): number {
  return fixMod(DIZHI_LIST.indexOf(branch) - 2);
}

/** 时支 → 子起时辰序 0..11（子=0） */
export function hourIndexFromBranch(branch: Dizhi): number {
  return DIZHI_LIST.indexOf(branch);
}

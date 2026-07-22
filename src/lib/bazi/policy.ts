/**
 * 八字历法 / 时间 / 未知时辰策略（T260）
 * 变更须同步 docs/research/bazi-sources.md 与 ruleSetVersion
 */

export const BAZI_SCHEMA_VERSION = "1.1.0";
export const BAZI_ENGINE_VERSION = "0.3.0";
export const BAZI_RULE_SET_VERSION = "2026.07-w24";
export const BAZI_SCHOOL = "ziping-default" as const;

/** 夜子时：23:00–24:00 日柱取次日（lunar-javascript setSect(1)） */
export type NightZiPolicy = "next_day";

/** 年柱以立春为界；月柱以十二节为界 */
export type JieqiPolicy = "lichun_year_jie_month";

/** 默认按东八区墙钟；真太阳时仅做经度+均时差，不回溯历史夏令时 */
export type TimezonePolicy = "asia_shanghai_wall_clock";

/** 未知时辰：六字盘 + 可选十二候选敏感性 */
export type UnknownHourPolicy = "six_pillars_plus_sensitivity";

export type BaziCalendarPolicy = {
  nightZi: NightZiPolicy;
  jieqi: JieqiPolicy;
  timezone: TimezonePolicy;
  unknownHour: UnknownHourPolicy;
  /** 真太阳时是否建模历史夏令时（当前 false） */
  historicalDst: false;
};

export const DEFAULT_CALENDAR_POLICY: BaziCalendarPolicy = {
  nightZi: "next_day",
  jieqi: "lichun_year_jie_month",
  timezone: "asia_shanghai_wall_clock",
  unknownHour: "six_pillars_plus_sensitivity",
  historicalDst: false,
};

export type RuleEvidence = {
  ruleId: string;
  source: string;
  conclusion: string;
  confidence: number;
  /** 可选条件摘要 */
  condition?: string;
};

export type PillarPosition = "year" | "month" | "day" | "hour";

export type TenGodByPosition = {
  position: PillarPosition;
  stem: string;
  tenGod: string;
};

export type YongshenLayered = {
  fuyi: { favorable: string[]; unfavorable: string[]; note: string };
  tiaohou: { favorable: string[]; note: string };
  tongguan: { favorable: string[]; note: string };
  bingyao: { disease: string[]; medicine: string[]; note: string };
};

export type HourSensitivityItem = {
  branch: string;
  hourStem: string;
  hourBranch: string;
  dayMaster: string;
  dayStem: string;
  dayBranch: string;
  flags: string[];
};

export type HourSensitivityReport = {
  baseDate: string;
  candidates: HourSensitivityItem[];
  dayPillarVariants: string[];
  hourPillarVariants: string[];
};

import type {
  BirthProfile,
  BaziChart,
  TenGodByPosition,
  RuleEvidence,
} from "@/lib/types";
import { buildPillars } from "./pillars";
import { computeDayun } from "./dayun";
import { calcTrueSolarTime } from "./solar-time";
import { detectBoundaryFlags } from "./boundary";
import { computeRelations } from "./relations";
import {
  HIDDEN_STEMS,
  HIDDEN_STEM_WEIGHTS,
  STEM_WUXING,
  STEM_YIN_YANG,
  changShengOf,
} from "./wuxing";
import {
  FLAG_TRUE_SOLAR_APPLIED,
  FLAG_TRUE_SOLAR_NO_LNG,
  FLAG_TRUE_SOLAR_CROSS_DAY,
  FLAG_DST_NOT_MODELED,
} from "./calendar/constants";
import { parseSolarDate } from "./calendar/solar";
import {
  BAZI_ENGINE_VERSION,
  BAZI_RULE_SET_VERSION,
  BAZI_SCHEMA_VERSION,
  BAZI_SCHOOL,
  DEFAULT_CALENDAR_POLICY,
} from "./policy";
import { computeYongshen } from "./yongshen";

export const ENGINE_VERSION = BAZI_ENGINE_VERSION;
export const SKILL_REF = "bazi-skill" as const;
export {
  BAZI_SCHEMA_VERSION,
  BAZI_RULE_SET_VERSION,
  BAZI_SCHOOL,
  DEFAULT_CALENDAR_POLICY,
} from "./policy";
export type {
  RuleEvidence,
  TenGodByPosition,
  YongshenLayered,
  HourSensitivityReport,
  BaziCalendarPolicy,
} from "./policy";

export { buildPillars } from "./pillars";
export type { BuildPillarsInput, BuildPillarsResult } from "./pillars";

export {
  FLAG_NIGHT_ZI,
  FLAG_SHICHEN_UNKNOWN,
  FLAG_LICHUN_NEAR,
  FLAG_JIEQI_BOUNDARY,
  FLAG_TRUE_SOLAR_NO_LNG,
  FLAG_TRUE_SOLAR_APPLIED,
  FLAG_TRUE_SOLAR_CROSS_DAY,
  FLAG_DST_NOT_MODELED,
  FLAG_LABELS,
  labelFlag,
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  WUSHU_ZI_STEM,
  hourStemFromDayStem,
  branchFromHour,
  computeRawPillars,
  lunarToSolarDate,
  parseSolarDate,
} from "./calendar";

export {
  HIDDEN_STEMS,
  HIDDEN_STEM_WEIGHTS,
  STEM_WUXING,
  BRANCH_WUXING,
} from "./wuxing";
export {
  computeYongshen,
  estimateStrength,
  countTenGodsByPosition,
} from "./yongshen";
export type { YongshenAdvice, StrengthLevel, WuxingKey } from "./yongshen";

export { computeDayun } from "./dayun";
export type { ComputeDayunResult } from "./dayun";

export { calcSolarTimeOffset, calcTrueSolarTime } from "./solar-time";
export type { TrueSolarTimeResult } from "./solar-time";

export { computeRelations } from "./relations";
export { detectBoundaryFlags } from "./boundary";
export {
  buildHourSensitivityReport,
  formatHourSensitivityDiff,
} from "./sensitivity";

const WUXING_RELATIONS: Record<
  string,
  { shengWo: string; woSheng: string; keWo: string; woKe: string }
> = {
  wood: { shengWo: "water", woSheng: "fire", keWo: "metal", woKe: "earth" },
  fire: { shengWo: "wood", woSheng: "earth", keWo: "water", woKe: "metal" },
  earth: { shengWo: "fire", woSheng: "metal", keWo: "wood", woKe: "water" },
  metal: { shengWo: "earth", woSheng: "water", keWo: "fire", woKe: "wood" },
  water: { shengWo: "metal", woSheng: "wood", keWo: "earth", woKe: "fire" },
};

const TEN_GOD_MAP: Record<string, [string, string]> = {
  shengWo: ["偏印", "正印"],
  woSheng: ["食神", "伤官"],
  keWo: ["七杀", "正官"],
  woKe: ["偏财", "正财"],
  tongWo: ["比肩", "劫财"],
};

function deriveTenGod(dayMaster: string, otherStem: string): string {
  if (dayMaster === otherStem) return "比肩";
  const dayWx = STEM_WUXING[dayMaster as keyof typeof STEM_WUXING];
  const otherWx = STEM_WUXING[otherStem as keyof typeof STEM_WUXING];
  if (!dayWx || !otherWx)
    throw new Error(`Invalid stem: ${dayMaster} or ${otherStem}`);
  let rel: string;
  if (dayWx === otherWx) {
    rel = "tongWo";
  } else {
    const cycle = WUXING_RELATIONS[dayWx];
    if (cycle.woSheng === otherWx) rel = "woSheng";
    else if (cycle.shengWo === otherWx) rel = "shengWo";
    else if (cycle.woKe === otherWx) rel = "woKe";
    else if (cycle.keWo === otherWx) rel = "keWo";
    else throw new Error(`Cannot determine relationship: ${dayWx} vs ${otherWx}`);
  }
  const sameYinYang =
    STEM_YIN_YANG[dayMaster as keyof typeof STEM_YIN_YANG] ===
    STEM_YIN_YANG[otherStem as keyof typeof STEM_YIN_YANG];
  return TEN_GOD_MAP[rel][sameYinYang ? 0 : 1];
}

export function computeChart(profile: BirthProfile): BaziChart {
  if (!profile.solarDate) {
    throw new Error("solarDate is required");
  }
  // 严格日期校验（含非法日）
  parseSolarDate(profile.solarDate);

  let effectiveSolarDate = profile.solarDate;
  let effectiveBirthTime = profile.birthTime;
  const flagsExtra: string[] = [];
  const warnings: string[] = [];

  if (
    profile.useTrueSolarTime &&
    !profile.shichenUnknown &&
    profile.birthTime != null &&
    profile.birthTime !== ""
  ) {
    if (profile.birthPlace?.lng != null && Number.isFinite(profile.birthPlace.lng)) {
      const tst = calcTrueSolarTime(
        profile.birthPlace.lng,
        profile.solarDate,
        profile.birthTime,
      );
      effectiveSolarDate = tst.solarDate;
      effectiveBirthTime = tst.birthTime;
      flagsExtra.push(FLAG_TRUE_SOLAR_APPLIED);
      if (tst.dayDelta !== 0) {
        flagsExtra.push(FLAG_TRUE_SOLAR_CROSS_DAY);
        warnings.push(
          `真太阳时跨日 dayDelta=${tst.dayDelta}，有效日 ${effectiveSolarDate} ${effectiveBirthTime}`,
        );
      }
      // 策略：未建模历史夏令时
      flagsExtra.push(FLAG_DST_NOT_MODELED);
      warnings.push("真太阳时未回溯历史夏令时与行政时区变更");
    } else {
      flagsExtra.push(FLAG_TRUE_SOLAR_NO_LNG);
      warnings.push("已开启真太阳时但缺少出生地经度");
    }
  }

  const pillarsResult = buildPillars({
    solarDate: effectiveSolarDate,
    birthTime: effectiveBirthTime,
    shichenUnknown: profile.shichenUnknown,
  });

  let birthHour = 12;
  let birthMinute = 0;
  if (effectiveBirthTime && !profile.shichenUnknown) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(effectiveBirthTime);
    if (m) {
      birthHour = Number(m[1]);
      birthMinute = Number(m[2]);
    }
  }

  const baseDate = profile.analysisBaseDate || new Date().toISOString().slice(0, 10);
  const currentYear = Number(baseDate.slice(0, 4));

  const dayunResult = computeDayun(
    pillarsResult.dayMaster,
    pillarsResult.month,
    pillarsResult.year.stem,
    profile.gender,
    effectiveSolarDate,
    birthHour,
    birthMinute,
    profile.alive ? undefined : profile.deathYear,
    currentYear,
  );

  const pillarSlots: {
    position: TenGodByPosition["position"];
    stem: string;
  }[] = [
    { position: "year", stem: pillarsResult.year.stem },
    { position: "month", stem: pillarsResult.month.stem },
    { position: "day", stem: pillarsResult.day.stem },
  ];
  if (pillarsResult.hour) {
    pillarSlots.push({ position: "hour", stem: pillarsResult.hour.stem });
  }

  // 按位置计数的十神（T261）
  const tenGodsByPosition: TenGodByPosition[] = pillarSlots.map(
    ({ position, stem }) => ({
      position,
      stem,
      tenGod:
        position === "day"
          ? "比肩"
          : deriveTenGod(pillarsResult.dayMaster, stem),
    }),
  );

  // 兼容旧 UI：同干合并表
  const tenGods: Record<string, string> = {};
  for (const item of tenGodsByPosition) {
    if (!tenGods[item.stem]) tenGods[item.stem] = item.tenGod;
  }

  const stems = pillarSlots.map((p) => p.stem);
  const branches = [
    pillarsResult.year.branch,
    pillarsResult.month.branch,
    pillarsResult.day.branch,
  ];
  if (pillarsResult.hour) branches.push(pillarsResult.hour.branch);
  const hiddenStems: Record<string, string[]> = {};
  for (const branch of branches) {
    if (!hiddenStems[branch])
      hiddenStems[branch] = [...(HIDDEN_STEMS[branch] ?? [])];
  }

  const relations = computeRelations(stems, branches, {
    monthBranch: pillarsResult.month.branch,
    orderedStems: stems,
  });

  // 固定藏干权重：仅可视化（T261）
  const wuxingScoresVisual: Record<string, number> = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };
  const pillarDatum = [
    { stem: pillarsResult.year.stem, branch: pillarsResult.year.branch },
    { stem: pillarsResult.month.stem, branch: pillarsResult.month.branch },
    { stem: pillarsResult.day.stem, branch: pillarsResult.day.branch },
  ];
  if (pillarsResult.hour) {
    pillarDatum.push({
      stem: pillarsResult.hour.stem,
      branch: pillarsResult.hour.branch,
    });
  }
  for (const { stem, branch } of pillarDatum) {
    const stemWx = STEM_WUXING[stem as keyof typeof STEM_WUXING];
    if (stemWx) wuxingScoresVisual[stemWx] += 1.0;
    const hidden = HIDDEN_STEMS[branch];
    if (hidden) {
      for (let i = 0; i < hidden.length; i++) {
        const weight =
          HIDDEN_STEM_WEIGHTS[i] ?? HIDDEN_STEM_WEIGHTS[HIDDEN_STEM_WEIGHTS.length - 1];
        const hsWx = STEM_WUXING[hidden[i] as keyof typeof STEM_WUXING];
        if (hsWx) wuxingScoresVisual[hsWx] += weight;
      }
    }
  }

  const boundaryFlags = detectBoundaryFlags({
    solarDate: effectiveSolarDate,
    birthTime: effectiveBirthTime,
    useTrueSolarTime: profile.useTrueSolarTime,
    lng: profile.birthPlace?.lng,
  });

  for (const f of boundaryFlags) {
    if (f === "jieqi_boundary") {
      warnings.push("节气交界：月柱可能双解，请核对交节时刻");
    }
    if (f === "lichun_near") {
      warnings.push("立春前后：年柱可能交界，请核对");
    }
  }
  if (pillarsResult.flags.includes("night_zi")) {
    warnings.push("夜子时：日柱按次日（sect=1）");
  }
  if (pillarsResult.flags.includes("shichen_unknown")) {
    warnings.push("时辰未知：仅六字盘，建议十二时辰敏感性分析");
  }

  const flagSet = new Set([
    ...pillarsResult.flags,
    ...flagsExtra,
    ...boundaryFlags,
  ]);

  const yearTg = tenGodsByPosition.find((t) => t.position === "year")!.tenGod;
  const monthTg = tenGodsByPosition.find((t) => t.position === "month")!.tenGod;
  const dayTg = tenGodsByPosition.find((t) => t.position === "day")!.tenGod;
  const hourTg = tenGodsByPosition.find((t) => t.position === "hour")?.tenGod;

  const partialChart: BaziChart = {
    profileId: profile.id,
    pillars: {
      year: {
        ...pillarsResult.year,
        tenGod: yearTg,
        hiddenStems: [...(HIDDEN_STEMS[pillarsResult.year.branch] ?? [])],
      },
      month: {
        ...pillarsResult.month,
        tenGod: monthTg,
        hiddenStems: [...(HIDDEN_STEMS[pillarsResult.month.branch] ?? [])],
      },
      day: {
        ...pillarsResult.day,
        tenGod: dayTg,
        hiddenStems: [...(HIDDEN_STEMS[pillarsResult.day.branch] ?? [])],
      },
      hour: pillarsResult.hour
        ? {
            ...pillarsResult.hour,
            tenGod: hourTg,
            hiddenStems: [
              ...(HIDDEN_STEMS[pillarsResult.hour.branch] ?? []),
            ],
          }
        : null,
    },
    dayMaster: pillarsResult.dayMaster,
    tenGods,
    tenGodsByPosition,
    hiddenStems,
    wuxingScores: wuxingScoresVisual as BaziChart["wuxingScores"],
    wuxingScoresVisual: wuxingScoresVisual as BaziChart["wuxingScores"],
    relations,
    dayun: dayunResult.dayun,
    currentDayunIndex: dayunResult.currentDayunIndex,
    liunian: dayunResult.liunian,
    startAgeDetail: dayunResult.startAgeDetail,
    changSheng: {
      year: changShengOf(
        pillarsResult.dayMaster,
        pillarsResult.year.branch,
      ),
      month: changShengOf(
        pillarsResult.dayMaster,
        pillarsResult.month.branch,
      ),
      day: changShengOf(
        pillarsResult.dayMaster,
        pillarsResult.day.branch,
      ),
      hour: pillarsResult.hour
        ? changShengOf(
            pillarsResult.dayMaster,
            pillarsResult.hour.branch,
          )
        : null,
    },
    flags: [...flagSet],
    warnings,
    meta: {
      engineVersion: ENGINE_VERSION,
      skillRef: SKILL_REF,
      schemaVersion: BAZI_SCHEMA_VERSION,
      ruleSetVersion: BAZI_RULE_SET_VERSION,
      school: BAZI_SCHOOL,
      calendarPolicy: { ...DEFAULT_CALENDAR_POLICY },
    },
  };

  const yong = computeYongshen(partialChart);
  const baseEvidence: RuleEvidence[] = [
    {
      ruleId: "calendar.night_zi.v1",
      source: "policy.nightZi=next_day",
      conclusion: pillarsResult.flags.includes("night_zi")
        ? "夜子时日柱取次日"
        : "非夜子时",
      confidence: 1,
    },
    {
      ruleId: "dayun.startAt.v1",
      source: "dayun-rules 起运到节÷3",
      conclusion: dayunResult.startAgeDetail.startAt
        ? `交运日 ${dayunResult.startAgeDetail.startAt}`
        : "交运日未算",
      confidence: 0.9,
      condition: `diffDays=${dayunResult.startAgeDetail.diffDays.toFixed(3)}`,
    },
    ...(yong.evidence ?? []),
  ];

  return {
    ...partialChart,
    yongshenLayered: yong.layered,
    evidence: baseEvidence,
  };
}

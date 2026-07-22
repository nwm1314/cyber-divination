/**
 * 紫微大限 / 流年（三合 · T102）
 * 表驱动纯函数；规则见 references/daxian-liunian.md
 */

// @ts-expect-error lunar-javascript 无官方类型
import { Solar } from "lunar-javascript";
import type {
  Dizhi,
  YunSihuaItem,
  ZiweiDaxianStep,
  ZiweiLiunianItem,
  ZiweiLiuriItem,
  ZiweiLiuyueItem,
  ZiweiPalace,
  ZiweiPalaceName,
} from "@/lib/types/ziwei";
import type { Tiangan, WuxingJuName } from "../tables/constants";
import {
  DIZHI_LIST,
  PALACE_NAMES,
  TIANGAN_LIST,
  WUXING_JU_VALUE,
  branchFromYinIndex,
  fixMod,
  yinIndexFromBranch,
} from "../tables/constants";
import {
  flightsToYunSihua,
  sihuaFlightsFromStem,
} from "../feixing";
import { liuChangQuByYearBranch } from "../tables/liuchang";

const YANG_STEMS = new Set<string>(["甲", "丙", "戊", "庚", "壬"]);

export const FLAG_DAXIAN_SANHE = "daxian_sanhe_tables";
/**
 * @deprecated T270 起改用严格虚岁 FLAG_DAXIAN_AGE_XUSUI；保留常量以免外部引用断裂
 */
export const FLAG_DAXIAN_AGE_SOLAR = "daxian_age_solar_diff";
/** 严格虚岁 age = year - birthYear + 1（T270） */
export const FLAG_DAXIAN_AGE_XUSUI = "daxian_age_xusui";
export const FLAG_LIUNIAN_YEAR_BRANCH = "liunian_by_year_branch";
export const FLAG_DEATH_CLAMP = "death_year_clamp";
/** 大限/流年运限飞星叠盘（T200/T201） */
export const FLAG_YUN_FEIXING = "yun_feixing_overlay";
/** 流月/流日叠盘（T240） */
export const FLAG_LIUYUE = "liuyue_by_month_gz";
export const FLAG_LIURI = "liuri_by_day_gz";

/**
 * 严格虚岁：出生年虚岁 1，次年 2…
 * age = year - birthYear + 1
 */
export function xusuiAge(year: number, birthYear: number): number {
  return year - birthYear + 1;
}

export type DaxianDirection = "forward" | "reverse";

export type ComputeDaxianInput = {
  palaces: ZiweiPalace[];
  /** 命宫寅起索引 */
  mingYinIndex: number;
  yearStem: Tiangan;
  gender: "male" | "female";
  wuxingJu: WuxingJuName | string;
  birthYear: number;
  /** 分析基准年（公历） */
  baseYear: number;
  /** 分析基准月 1–12；缺省 6 */
  baseMonth?: number;
  /** 分析基准日 1–31；缺省 15 */
  baseDay?: number;
  alive?: boolean;
  deathYear?: number;
};

export type ComputeDaxianResult = {
  daxian: ZiweiDaxianStep[];
  currentDaxianIndex: number;
  liunian: ZiweiLiunianItem[];
  liuyue: ZiweiLiuyueItem[];
  liuri: ZiweiLiuriItem[];
  flags: string[];
  direction: DaxianDirection;
  startAge: number;
};

/** 年干阴阳 × 性别 → 顺/逆 */
export function daxianDirection(
  yearStem: string,
  gender: "male" | "female",
): DaxianDirection {
  const yang = YANG_STEMS.has(yearStem);
  if ((yang && gender === "male") || (!yang && gender === "female")) {
    return "forward";
  }
  return "reverse";
}

/** 五行局 → 起限岁数 */
export function startAgeFromJu(wuxingJu: string): number {
  if (wuxingJu in WUXING_JU_VALUE) {
    return WUXING_JU_VALUE[wuxingJu as WuxingJuName];
  }
  const m = wuxingJu.match(/([2-6])/);
  if (m) return Number(m[1]);
  throw new Error(`invalid wuxingJu: ${wuxingJu}`);
}

/**
 * 大限第 i 步落宫名（0=命宫）
 * 顺：命→父母→福…；逆：命→兄→夫…
 */
export function daxianPalaceName(
  stepIndex: number,
  direction: DaxianDirection,
): ZiweiPalaceName {
  if (direction === "forward") {
    // 命(0) → 父母(11) → 福德(10) → … 即 nameIdx = (0 - step) mod 12 的反向：-step
    // 顺行地支 = 命宫 yin+step；宫名 = fixMod(ming - (ming+step)) = fixMod(-step)
    return PALACE_NAMES[fixMod(-stepIndex)];
  }
  // 逆行：命→兄→夫… nameIdx = step
  return PALACE_NAMES[fixMod(stepIndex)];
}

/** 大限第 i 步地支（由命宫支 + 顺/逆） */
export function daxianBranch(
  mingBranch: Dizhi,
  stepIndex: number,
  direction: DaxianDirection,
): Dizhi {
  const mingYin = yinIndexFromBranch(mingBranch);
  const delta = direction === "forward" ? stepIndex : -stepIndex;
  return branchFromYinIndex(fixMod(mingYin + delta));
}

function generateDaxianSteps(
  mingBranch: Dizhi,
  startAge: number,
  direction: DaxianDirection,
  palaces: ZiweiPalace[],
): ZiweiDaxianStep[] {
  const steps: ZiweiDaxianStep[] = [];
  for (let i = 0; i < 12; i++) {
    const sa = startAge + i * 10;
    const palace = daxianPalaceName(i, direction);
    const branch = daxianBranch(mingBranch, i, direction);
    const p = palaces.find((x) => x.name === palace);
    const stem = p?.stem;
    const label = `大限·${palace}`;
    const flights = sihuaFlightsFromStem(stem, palaces, label);
    const sihuaOut: YunSihuaItem[] = flightsToYunSihua(flights);
    steps.push({
      index: i,
      startAge: sa,
      endAge: sa + 9,
      palace,
      branch,
      ...(stem ? { stem } : {}),
      ...(sihuaOut.length ? { sihuaOut } : {}),
    });
  }
  return steps;
}

function yearGanZhi(year: number): { stem: string; branch: Dizhi } {
  const s = Solar.fromYmd(year, 6, 1);
  const l = s.getLunar();
  const branch = l.getYearZhi() as Dizhi;
  if (!(DIZHI_LIST as readonly string[]).includes(branch)) {
    throw new Error(`invalid year branch: ${branch}`);
  }
  return { stem: l.getYearGan(), branch };
}

function palaceNameByBranch(
  palaces: ZiweiPalace[],
  branch: Dizhi,
): ZiweiPalaceName | string {
  const p = palaces.find((x) => x.branch === branch);
  return p?.name ?? branch;
}

function palaceNameByYin(
  palaces: ZiweiPalace[],
  yinIndex: number,
): ZiweiPalaceName | string {
  const branch = branchFromYinIndex(yinIndex);
  return palaceNameByBranch(palaces, branch);
}

function generateLiunian(
  palaces: ZiweiPalace[],
  birthYear: number,
  effectiveYear: number,
  deathYear?: number,
): ZiweiLiunianItem[] {
  const years: number[] = [];
  for (let y = effectiveYear - 2; y <= effectiveYear; y++) {
    if (deathYear !== undefined && y > deathYear) continue;
    if (y < birthYear) continue;
    years.push(y);
  }
  return years.map((y) => {
    const gz = yearGanZhi(y);
    const stem = gz.stem;
    const label = `流年·${y}`;
    const flights = sihuaFlightsFromStem(stem, palaces, label);
    const sihuaOut = flightsToYunSihua(flights);
    const cq = liuChangQuByYearBranch(gz.branch);
    return {
      year: y,
      age: xusuiAge(y, birthYear),
      branch: gz.branch,
      palace: palaceNameByBranch(palaces, gz.branch),
      stem,
      ...(sihuaOut.length ? { sihuaOut } : {}),
      liuChangPalace: palaceNameByYin(palaces, cq.liuChang),
      liuQuPalace: palaceNameByYin(palaces, cq.liuQu),
    };
  });
}

function clampDateParts(
  year: number,
  month: number,
  day: number,
): { y: number; m: number; d: number } {
  const m = Math.min(12, Math.max(1, Math.floor(month)));
  const dim = new Date(year, m, 0).getDate();
  const d = Math.min(dim, Math.max(1, Math.floor(day)));
  return { y: year, m, d };
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function shiftDay(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const dt = new Date(year, month - 1, day);
  dt.setDate(dt.getDate() + delta);
  return {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
  };
}

function monthGanZhi(
  year: number,
  month: number,
  day: number,
): { stem: string; branch: Dizhi } {
  const { y, m, d } = clampDateParts(year, month, day);
  const s = Solar.fromYmd(y, m, d);
  const l = s.getLunar();
  const branch = l.getMonthZhi() as Dizhi;
  if (!(DIZHI_LIST as readonly string[]).includes(branch)) {
    throw new Error(`invalid month branch: ${branch}`);
  }
  return { stem: l.getMonthGan(), branch };
}

function dayGanZhi(
  year: number,
  month: number,
  day: number,
): { stem: string; branch: Dizhi } {
  const { y, m, d } = clampDateParts(year, month, day);
  const s = Solar.fromYmd(y, m, d);
  const l = s.getLunar();
  const branch = l.getDayZhi() as Dizhi;
  if (!(DIZHI_LIST as readonly string[]).includes(branch)) {
    throw new Error(`invalid day branch: ${branch}`);
  }
  return { stem: l.getDayGan(), branch };
}

/**
 * 流月：基准月 ±1（表驱动月干四化 + 月支落宫；T240）
 */
function generateLiuyue(
  palaces: ZiweiPalace[],
  year: number,
  month: number,
  day: number,
  deathYear?: number,
): ZiweiLiuyueItem[] {
  const items: ZiweiLiuyueItem[] = [];
  for (const delta of [-1, 0, 1]) {
    const sm = shiftMonth(year, month, delta);
    if (deathYear !== undefined && sm.year > deathYear) continue;
    const midDay = delta === 0 ? day : 15;
    const gz = monthGanZhi(sm.year, sm.month, midDay);
    const label = `流月·${sm.year}-${String(sm.month).padStart(2, "0")}`;
    const flights = sihuaFlightsFromStem(gz.stem, palaces, label);
    const sihuaOut = flightsToYunSihua(flights);
    items.push({
      month: `${sm.year}-${String(sm.month).padStart(2, "0")}`,
      year: sm.year,
      monthIndex: sm.month,
      branch: gz.branch,
      palace: palaceNameByBranch(palaces, gz.branch),
      stem: gz.stem,
      ...(sihuaOut.length ? { sihuaOut } : {}),
    });
  }
  return items;
}

/**
 * 流日：基准日 ±1（日干四化 + 日支落宫；T240）
 */
function generateLiuri(
  palaces: ZiweiPalace[],
  year: number,
  month: number,
  day: number,
  deathYear?: number,
): ZiweiLiuriItem[] {
  const items: ZiweiLiuriItem[] = [];
  for (const delta of [-1, 0, 1]) {
    const sd = shiftDay(year, month, day, delta);
    if (deathYear !== undefined && sd.year > deathYear) continue;
    const gz = dayGanZhi(sd.year, sd.month, sd.day);
    const date = `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}`;
    const label = `流日·${date}`;
    const flights = sihuaFlightsFromStem(gz.stem, palaces, label);
    const sihuaOut = flightsToYunSihua(flights);
    items.push({
      date,
      year: sd.year,
      monthIndex: sd.month,
      day: sd.day,
      branch: gz.branch,
      palace: palaceNameByBranch(palaces, gz.branch),
      stem: gz.stem,
      ...(sihuaOut.length ? { sihuaOut } : {}),
    });
  }
  return items;
}

function resolveEffectiveYear(
  baseYear: number,
  alive: boolean | undefined,
  deathYear: number | undefined,
): { year: number; clamped: boolean } {
  if (alive === false && deathYear !== undefined && Number.isFinite(deathYear)) {
    return {
      year: Math.min(baseYear, deathYear),
      clamped: deathYear < baseYear,
    };
  }
  return { year: baseYear, clamped: false };
}

/**
 * 生成大限序列、当前限、近流年
 */
export function computeDaxian(input: ComputeDaxianInput): ComputeDaxianResult {
  const {
    palaces,
    yearStem,
    gender,
    wuxingJu,
    birthYear,
    baseYear,
    baseMonth = 6,
    baseDay = 15,
    alive,
    deathYear,
  } = input;

  if (!Number.isFinite(birthYear)) {
    throw new Error(`invalid birthYear: ${birthYear}`);
  }
  if (!Number.isFinite(baseYear)) {
    throw new Error(`invalid baseYear: ${baseYear}`);
  }
  if (!(TIANGAN_LIST as readonly string[]).includes(yearStem)) {
    throw new Error(`invalid yearStem: ${yearStem}`);
  }

  const mingPalace = palaces.find((p) => p.name === "命宫");
  if (!mingPalace) throw new Error("palaces missing 命宫");

  const direction = daxianDirection(yearStem, gender);
  const startAge = startAgeFromJu(wuxingJu);
  const daxian = generateDaxianSteps(
    mingPalace.branch,
    startAge,
    direction,
    palaces,
  );

  const { year: effectiveYear, clamped } = resolveEffectiveYear(
    baseYear,
    alive,
    deathYear,
  );
  // T270：严格虚岁（非 基准年-出生年 周岁）
  const currentAge = xusuiAge(effectiveYear, birthYear);

  let currentDaxianIndex = -1;
  for (const step of daxian) {
    const idx = step.index ?? -1;
    if (currentAge >= step.startAge && currentAge <= step.endAge) {
      currentDaxianIndex = idx;
      break;
    }
  }

  const deathClamp = alive === false ? deathYear : undefined;
  const liunian = generateLiunian(
    palaces,
    birthYear,
    effectiveYear,
    deathClamp,
  );

  const effectiveMonth =
    effectiveYear === baseYear ? baseMonth : effectiveYear < baseYear ? 12 : 1;
  const effectiveDay =
    effectiveYear === baseYear && effectiveMonth === baseMonth
      ? baseDay
      : 15;

  const liuyue = generateLiuyue(
    palaces,
    effectiveYear,
    effectiveMonth,
    effectiveDay,
    deathClamp,
  );
  const liuri = generateLiuri(
    palaces,
    effectiveYear,
    effectiveMonth,
    effectiveDay,
    deathClamp,
  );

  const flags = [
    FLAG_DAXIAN_SANHE,
    FLAG_DAXIAN_AGE_XUSUI,
    FLAG_LIUNIAN_YEAR_BRANCH,
    FLAG_YUN_FEIXING,
    FLAG_LIUYUE,
    FLAG_LIURI,
  ];
  if (clamped || (alive === false && deathYear !== undefined)) {
    flags.push(FLAG_DEATH_CLAMP);
  }

  return {
    daxian,
    currentDaxianIndex,
    liunian,
    liuyue,
    liuri,
    flags,
    direction,
    startAge,
  };
}

export {
  yearGanZhi as yearGanZhiForTest,
  monthGanZhi as monthGanZhiForTest,
  dayGanZhi as dayGanZhiForTest,
};

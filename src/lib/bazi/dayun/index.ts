// @ts-expect-error lunar-javascript 无官方类型
import { Solar } from "lunar-javascript";
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from "../calendar/constants";
import type {
  Pillar,
  DayunStep,
  LiunianItem,
  Gender,
  StartAgeDetail,
} from "@/lib/types";

const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);

function isYang(stem: string): boolean {
  return YANG_STEMS.has(stem);
}

function getDirection(yearStem: string, gender: Gender): "forward" | "reverse" {
  const yang = isYang(yearStem);
  if ((yang && gender === "male") || (!yang && gender === "female")) {
    return "forward";
  }
  return "reverse";
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addMonthsUtc(
  year: number,
  month: number,
  day: number,
  addMonths: number,
): { year: number; month: number; day: number } {
  const base = Date.UTC(year, month - 1, day);
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + addMonths);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * 起运：出生日到最近节（顺/逆）天数 ÷ 3
 * skill：整岁 = round(天/3)；余 1 天≈4 月、余 2 天≈8 月
 * 交运日 startAt = 出生日期 + years*12 + months 个月
 */
function calcStartAgeDetail(
  birthDate: string,
  birthHour: number,
  birthMinute: number,
  direction: "forward" | "reverse",
): StartAgeDetail {
  const parts = birthDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const solar = Solar.fromYmdHms(year, month, day, birthHour, birthMinute, 0);
  const lunar = solar.getLunar();
  const jie = direction === "forward" ? lunar.getNextJie() : lunar.getPrevJie();
  const js = jie.getSolar();

  const birthMs = Date.UTC(year, month - 1, day, birthHour, birthMinute, 0);
  const jieSecond =
    typeof js.getSecond === "function" ? Number(js.getSecond()) || 0 : 0;
  const jieMs = Date.UTC(
    js.getYear(),
    js.getMonth() - 1,
    js.getDay(),
    js.getHour(),
    js.getMinute(),
    jieSecond,
  );

  let diffDays =
    direction === "forward" ? jieMs - birthMs : birthMs - jieMs;
  diffDays /= 1000 * 60 * 60 * 24;
  if (diffDays < 0) diffDays = 0;

  const raw = diffDays / 3;
  let years = Math.floor(raw + 1e-9);
  let months = Math.round((raw - years) * 12);
  if (months >= 12) {
    years += 1;
    months = 0;
  }

  const totalMonths = years * 12 + months;
  const start = addMonthsUtc(year, month, day, totalMonths);
  const startAt = formatYmd(start.year, start.month, start.day);

  return { years, months, diffDays, startAt };
}

/** 兼容：整岁 = round(天/3) */
function toRoundedStartAge(detail: StartAgeDetail): number {
  return Math.round(detail.diffDays / 3);
}

function shiftStem(stem: string, n: number, dir: "forward" | "reverse"): string {
  const idx = HEAVENLY_STEMS.indexOf(stem as (typeof HEAVENLY_STEMS)[number]);
  const offset = dir === "forward" ? n : -n;
  return HEAVENLY_STEMS[(((idx + offset) % 10) + 10) % 10];
}

function shiftBranch(
  branch: string,
  n: number,
  dir: "forward" | "reverse",
): string {
  const idx = EARTHLY_BRANCHES.indexOf(
    branch as (typeof EARTHLY_BRANCHES)[number],
  );
  const offset = dir === "forward" ? n : -n;
  return EARTHLY_BRANCHES[(((idx + offset) % 12) + 12) % 12];
}

function yearGanZhi(year: number): { stem: string; branch: string } {
  const s = Solar.fromYmd(year, 6, 1);
  const l = s.getLunar();
  return { stem: l.getYearGan(), branch: l.getYearZhi() };
}

function generateDayunSteps(
  monthPillar: Pillar,
  startAge: number,
  startAgeMonths: number,
  birthYear: number,
  direction: "forward" | "reverse",
  firstStartAt?: string,
): DayunStep[] {
  const steps: DayunStep[] = [];

  if (startAge > 0 || startAgeMonths > 0) {
    steps.push({
      index: -1,
      stem: monthPillar.stem,
      branch: monthPillar.branch,
      startAge: 0,
      endAge: startAge > 0 ? startAge - 1 : 0,
      startYear: birthYear,
      endYear: birthYear + Math.max(0, startAge - 1),
      startAgeMonths: 0,
      isPreDayun: true,
    });
  }

  for (let i = 0; i < 8; i++) {
    const stepStart = startAge + i * 10;
    const step: DayunStep = {
      index: i,
      stem: shiftStem(monthPillar.stem, i + 1, direction),
      branch: shiftBranch(monthPillar.branch, i + 1, direction),
      startAge: stepStart,
      endAge: stepStart + 9,
      startYear: birthYear + stepStart,
      endYear: birthYear + stepStart + 9,
      startAgeMonths: i === 0 ? startAgeMonths : 0,
      isPreDayun: false,
    };
    if (i === 0 && firstStartAt) {
      step.startAt = firstStartAt;
    } else if (i > 0 && firstStartAt) {
      const base = firstStartAt.split("-").map(Number);
      const shifted = addMonthsUtc(base[0], base[1], base[2], i * 10 * 12);
      step.startAt = formatYmd(shifted.year, shifted.month, shifted.day);
    }
    steps.push(step);
  }
  return steps;
}

function generateLiunian(
  currentYear: number,
  birthYear: number,
  deathYear?: number,
): LiunianItem[] {
  const years: number[] = [];
  const effectiveEnd =
    deathYear !== undefined ? Math.min(currentYear, deathYear) : currentYear;
  for (let y = effectiveEnd - 2; y <= effectiveEnd; y++) {
    if (deathYear !== undefined && y > deathYear) continue;
    years.push(y);
  }
  return years.map((y) => {
    const gz = yearGanZhi(y);
    return { year: y, stem: gz.stem, branch: gz.branch, age: y - birthYear };
  });
}

export type ComputeDayunResult = {
  dayun: DayunStep[];
  currentDayunIndex: number;
  liunian: LiunianItem[];
  startAgeDetail: StartAgeDetail;
};

export function computeDayun(
  _dayMaster: string,
  monthPillar: Pillar,
  yearStem: string,
  gender: Gender,
  birthDate: string,
  birthHour: number,
  birthMinute: number,
  deathYear?: number,
  currentYear?: number,
): ComputeDayunResult {
  const birthYear = Number(birthDate.slice(0, 4));
  if (!Number.isFinite(birthYear)) {
    throw new Error(`invalid birthDate: ${birthDate}`);
  }

  const cy = currentYear ?? new Date().getFullYear();
  const direction = getDirection(yearStem, gender);
  const startAgeDetail = calcStartAgeDetail(
    birthDate,
    birthHour,
    birthMinute,
    direction,
  );
  const startAge = toRoundedStartAge(startAgeDetail);
  const dayun = generateDayunSteps(
    monthPillar,
    startAge,
    startAgeDetail.months,
    birthYear,
    direction,
    startAgeDetail.startAt,
  );

  const effectiveYear =
    deathYear !== undefined && deathYear < cy ? deathYear : cy;
  const currentAge = effectiveYear - birthYear;

  let currentDayunIndex = -1;
  for (const step of dayun) {
    if (step.isPreDayun) continue;
    if (currentAge >= step.startAge && currentAge <= step.endAge) {
      currentDayunIndex = step.index;
      break;
    }
  }

  const liunian = generateLiunian(cy, birthYear, deathYear);

  return { dayun, currentDayunIndex, liunian, startAgeDetail };
}

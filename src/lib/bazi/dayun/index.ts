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
 *
 * 口径（见 docs/ENGINE_RULE_DAYUN_START.md §2）：**三天一岁·精确到月**，
 * 即 3 天 = 1 年、1 天 = 4 个月；余数保留为月，不四舍五入到整岁。
 *
 * 交运日 startAt = 出生日期 + (years*12 + months) 个月
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

  // 月级总折算：3 天 = 1 年 = 12 个月 ⇒ 1 天 = 4 个月。
  // 先算总月数再拆分，避免「先取整岁再对余数取整」两次取整叠加误差。
  const totalMonthsExact = (diffDays / 3) * 12;
  const totalMonths = Math.round(totalMonthsExact + 1e-9);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const start = addMonthsUtc(year, month, day, totalMonths);
  const startAt = formatYmd(start.year, start.month, start.day);

  return { years, months, diffDays, startAt };
}

/**
 * 起运总月数（供分档与交运判定）。
 *
 * 等价于 `years*12 + months`，即 3 天 = 1 年、1 天 = 4 个月的四舍五入到月。
 * 与 `calcStartAgeDetail` 使用同一取整规则，保证 `startAge`/`startAt`
 * 与 `currentDayunIndex` 三者自洽。
 */
function startTotalMonthsFromDetail(detail: StartAgeDetail): number {
  return detail.years * 12 + detail.months;
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
    // 每步起运的**精确**年龄：首步为起运的 years+months，
    // 其后每步整体后移 10 年（整周期），故余月继承首步。
    // 月级字段用于 currentDayunIndex 判定，见 startTotalMonthsFromDetail 注释。
    const stepStartMonths = i * 120;
    const totalMonths = startAge * 12 + startAgeMonths + stepStartMonths;
    const stepStart = Math.floor(totalMonths / 12);

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
  // 起运整岁（用于展示字段）与总月数（用于分档判定）同源，
  // 二者由同一 totalMonths 拆分而来，保证 startAge/endAge/startAt/
  // currentDayunIndex 四者自洽（见 docs/ENGINE_RULE_DAYUN_START.md）。
  const startTotalMonths = startTotalMonthsFromDetail(startAgeDetail);
  const startAge = Math.floor(startTotalMonths / 12);
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

  // 按**月**判定当前大运：交运日当天即切换，不再出现
  // 「交运日已到但索引仍停在上一运」的整岁错位。
  // 月数口径：以分析年度 1 月为观察点，即 (年龄)*12 + 0；
  // 起运月数为 0 时退化为原有整岁行为，保持向后兼容。
  const currentAgeMonths = currentAge * 12;

  let currentDayunIndex = -1;
  const formal = dayun.filter((d) => !d.isPreDayun);
  for (let i = 0; i < formal.length; i++) {
    const step = formal[i];
    const stepStartMonths = step.startAge * 12 + (step.startAgeMonths ?? 0);
    const next = formal[i + 1];
    const nextStartMonths = next
      ? next.startAge * 12 + (next.startAgeMonths ?? 0)
      : stepStartMonths + 120;

    if (
      currentAgeMonths >= stepStartMonths &&
      currentAgeMonths < nextStartMonths
    ) {
      currentDayunIndex = step.index;
      break;
    }
  }

  const liunian = generateLiunian(cy, birthYear, deathYear);

  return { dayun, currentDayunIndex, liunian, startAgeDetail };
}

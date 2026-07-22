/**
 * 紫微用历：复用 lunar-javascript + 项目 bazi 时辰表
 */

// @ts-expect-error lunar-javascript 无官方类型
import { Solar, Lunar } from "lunar-javascript";
import {
  branchFromHour,
  isNightZiHour,
  lunarToSolarDate,
  parseBirthTime,
  parseSolarDate,
} from "@/lib/bazi/calendar";
import type { Dizhi } from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import {
  DIZHI_LIST,
  FLAG_DEFAULT_NOON,
  FLAG_LEAP_MONTH,
  FLAG_LEAP_MONTH_AS_SAME,
  FLAG_NIGHT_ZI,
  FLAG_SHICHEN_UNKNOWN,
  TIANGAN_LIST,
} from "./tables/constants";

export type ZiweiBirthContext = {
  solarDate: string;
  lunarYear: number;
  /** 农历月 1–12（闰月取绝对值） */
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  /** 时支；未知时默认午 */
  hourBranch: Dizhi;
  yearStem: Tiangan;
  yearBranch: Dizhi;
  flags: string[];
};

function asStem(s: string): Tiangan {
  if (!(TIANGAN_LIST as readonly string[]).includes(s)) {
    throw new Error(`invalid stem: ${s}`);
  }
  return s as Tiangan;
}

function asBranch(s: string): Dizhi {
  if (!(DIZHI_LIST as readonly string[]).includes(s)) {
    throw new Error(`invalid branch: ${s}`);
  }
  return s as Dizhi;
}

/**
 * 解析输入为农历年月日时 + 年干支
 * - 年干支取农历春节换年（lunar-javascript getYearGan/Zhi）
 * - 时辰未知：默认午时并打 flag
 */
export function resolveBirthContext(input: {
  solarDate?: string;
  lunarDate?: string;
  isLeapMonth?: boolean;
  birthTime?: string;
  shichenUnknown?: boolean;
}): ZiweiBirthContext {
  const flags: string[] = [];

  let solarDate: string;
  if (input.solarDate) {
    parseSolarDate(input.solarDate);
    solarDate = input.solarDate.trim();
  } else if (input.lunarDate) {
    solarDate = lunarToSolarDate(input.lunarDate, input.isLeapMonth === true);
  } else {
    throw new Error("solarDate or lunarDate required");
  }

  const { year, month, day } = parseSolarDate(solarDate);

  const unknown =
    input.shichenUnknown === true ||
    input.birthTime == null ||
    input.birthTime === "";

  let hour = 12;
  let minute = 0;
  let hourBranch: Dizhi = "午";

  if (unknown) {
    flags.push(FLAG_SHICHEN_UNKNOWN);
    flags.push(FLAG_DEFAULT_NOON);
  } else {
    const t = parseBirthTime(input.birthTime!);
    if (!t) throw new Error(`invalid birthTime: ${input.birthTime}`);
    hour = t.hour;
    minute = t.minute;
    hourBranch = branchFromHour(hour) as Dizhi;
    if (isNightZiHour(hour)) {
      flags.push(FLAG_NIGHT_ZI);
    }
  }

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar() as {
    getYear: () => number;
    getMonth: () => number;
    getDay: () => number;
    getYearGan: () => string;
    getYearZhi: () => string;
  };

  const lunarMonthRaw = lunar.getMonth();
  const isLeapMonth = lunarMonthRaw < 0;
  const lunarMonth = Math.abs(lunarMonthRaw);
  if (isLeapMonth) {
    flags.push(FLAG_LEAP_MONTH);
    flags.push(FLAG_LEAP_MONTH_AS_SAME);
  }

  return {
    solarDate,
    lunarYear: lunar.getYear(),
    lunarMonth,
    lunarDay: lunar.getDay(),
    isLeapMonth,
    hourBranch,
    yearStem: asStem(lunar.getYearGan()),
    yearBranch: asBranch(lunar.getYearZhi()),
    flags,
  };
}

/** 仅测试：由农历直接构造（跳过阳历） */
export function contextFromLunarYmd(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  hourBranch: Dizhi,
  isLeapMonth = false,
): ZiweiBirthContext {
  const lunarMonthArg = isLeapMonth ? -lunarMonth : lunarMonth;
  const lunar = Lunar.fromYmd(lunarYear, lunarMonthArg, lunarDay);
  const solar = lunar.getSolar();
  const y = solar.getYear();
  const mo = String(solar.getMonth()).padStart(2, "0");
  const d = String(solar.getDay()).padStart(2, "0");
  const flags: string[] = [];
  if (isLeapMonth) {
    flags.push(FLAG_LEAP_MONTH);
    flags.push(FLAG_LEAP_MONTH_AS_SAME);
  }
  return {
    solarDate: `${y}-${mo}-${d}`,
    lunarYear: lunar.getYear(),
    lunarMonth: Math.abs(lunar.getMonth()),
    lunarDay: lunar.getDay(),
    isLeapMonth,
    hourBranch,
    yearStem: asStem(lunar.getYearGan()),
    yearBranch: asBranch(lunar.getYearZhi()),
    flags,
  };
}

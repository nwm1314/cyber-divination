// @ts-expect-error lunar-javascript 无官方类型
import { Solar } from "lunar-javascript";
import type { HeavenlyStem, EarthlyBranch } from "./constants";
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from "./constants";

export type SolarDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type RawPillars = {
  yearStem: HeavenlyStem;
  yearBranch: EarthlyBranch;
  monthStem: HeavenlyStem;
  monthBranch: EarthlyBranch;
  dayStem: HeavenlyStem;
  dayBranch: EarthlyBranch;
  hourStem: HeavenlyStem;
  hourBranch: EarthlyBranch;
};

function asStem(s: string): HeavenlyStem {
  if (!(HEAVENLY_STEMS as readonly string[]).includes(s)) {
    throw new Error(`invalid stem: ${s}`);
  }
  return s as HeavenlyStem;
}

function asBranch(s: string): EarthlyBranch {
  if (!(EARTHLY_BRANCHES as readonly string[]).includes(s)) {
    throw new Error(`invalid branch: ${s}`);
  }
  return s as EarthlyBranch;
}

/**
 * 立春分年、节气分月、公历日柱、五鼠遁时柱。
 * setSect(1)：夜子时（23:00 后）日柱用次日。
 */
export function computeRawPillars(parts: SolarDateParts): RawPillars {
  const solar = Solar.fromYmdHms(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    0,
  );
  const eight = solar.getLunar().getEightChar();
  eight.setSect(1);
  return {
    yearStem: asStem(eight.getYearGan()),
    yearBranch: asBranch(eight.getYearZhi()),
    monthStem: asStem(eight.getMonthGan()),
    monthBranch: asBranch(eight.getMonthZhi()),
    dayStem: asStem(eight.getDayGan()),
    dayBranch: asBranch(eight.getDayZhi()),
    hourStem: asStem(eight.getTimeGan()),
    hourBranch: asBranch(eight.getTimeZhi()),
  };
}

/**
 * 严格校验公历日期（含闰年 2/29、月份天数）
 */
export function parseSolarDate(solarDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate.trim());
  if (!m) throw new Error(`invalid solarDate: ${solarDate}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`invalid solarDate: ${solarDate}`);
  }
  // UTC 构造再回读，拒绝 2023-02-30 等非法日
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`invalid solarDate: ${solarDate}`);
  }
  if (year < 1900 || year > 2100) {
    throw new Error(`solarDate out of supported range: ${solarDate}`);
  }
  return { year, month, day };
}

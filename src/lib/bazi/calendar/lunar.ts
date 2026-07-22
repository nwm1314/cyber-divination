// @ts-expect-error lunar-javascript 无官方类型
import { Lunar } from "lunar-javascript";

/**
 * 农历 YYYY-M-D / YYYY-MM-DD 转阳历 YYYY-MM-DD
 * isLeapMonth 为 true 时按闰月处理
 */
export function lunarToSolarDate(
  lunarDate: string,
  isLeapMonth = false,
): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(lunarDate.trim());
  if (!m) {
    throw new Error(`invalid lunarDate: ${lunarDate}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const lunarMonth = isLeapMonth ? -month : month;
  const lunar = Lunar.fromYmd(year, lunarMonth, day);
  const solar = lunar.getSolar();
  const y = solar.getYear();
  const mo = String(solar.getMonth()).padStart(2, "0");
  const d = String(solar.getDay()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

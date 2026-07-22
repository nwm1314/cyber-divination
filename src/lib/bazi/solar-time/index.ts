/**
 * 真太阳时校正
 * 经度偏移 + 均时差 → 返回校正后日期与 HH:mm（可跨日）
 */

export type TrueSolarTimeResult = {
  /** 校正后公历日期 YYYY-MM-DD */
  solarDate: string;
  /** 校正后时间 HH:mm */
  birthTime: string;
  /** 相对原生日历日的偏移：-1 / 0 / 1 */
  dayDelta: number;
};

function dayOfYear(year: number, month: number, day: number): number {
  const date = new Date(year, month - 1, day);
  const start = new Date(year, 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function equationOfTime(doy: number): number {
  const gamma = (2 * Math.PI) / 365 * (doy - 1);
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.04089 * Math.sin(2 * gamma))
  );
}

function shiftDate(year: number, month: number, day: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 完整真太阳时（含跨日）
 */
export function calcTrueSolarTime(
  lng: number,
  birthDate: string,
  birthTime: string,
): TrueSolarTimeResult {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!dm) throw new Error(`invalid birthDate: ${birthDate}`);
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);

  const tm = /^(\d{1,2}):(\d{2})$/.exec(birthTime.trim());
  if (!tm) throw new Error(`invalid birthTime: ${birthTime}`);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`invalid birthTime: ${birthTime}`);
  }

  const lngOffset = (lng - 120) * 4;
  const doy = dayOfYear(year, month, day);
  const eot = equationOfTime(doy);
  const totalOffset = lngOffset + eot;

  let totalMinutes = hour * 60 + minute + totalOffset;
  let dayDelta = 0;

  while (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    dayDelta += 1;
  }
  while (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    dayDelta -= 1;
  }

  let resultHour = Math.floor(totalMinutes / 60);
  let resultMinute = Math.round(totalMinutes % 60);

  if (resultMinute >= 60) {
    resultHour += 1;
    resultMinute -= 60;
  } else if (resultMinute < 0) {
    resultHour -= 1;
    resultMinute += 60;
  }

  if (resultHour >= 24) {
    resultHour -= 24;
    dayDelta += 1;
  } else if (resultHour < 0) {
    resultHour += 24;
    dayDelta -= 1;
  }

  return {
    solarDate: shiftDate(year, month, day, dayDelta),
    birthTime: `${String(resultHour).padStart(2, "0")}:${String(resultMinute).padStart(2, "0")}`,
    dayDelta,
  };
}

/**
 * 兼容旧接口：仅返回校正后 HH:mm（跨日时仍 wrap 到 0–23）
 * @deprecated 排盘请用 calcTrueSolarTime 以正确处理跨日
 */
export function calcSolarTimeOffset(
  lng: number,
  birthDate: string,
  birthTime: string,
): string {
  return calcTrueSolarTime(lng, birthDate, birthTime).birthTime;
}

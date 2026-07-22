import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  SHICHEN_RANGES,
  WUSHU_ZI_STEM,
  type EarthlyBranch,
  type HeavenlyStem,
} from "./constants";

export type ParsedTime = {
  hour: number;
  minute: number;
};

export function parseBirthTime(time: string): ParsedTime | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

/** 夜子时：23:00–24:00 */
export function isNightZiHour(hour: number): boolean {
  return hour === 23;
}

export function branchFromHour(hour: number): EarthlyBranch {
  if (hour === 23 || hour === 0) return "子";
  for (const r of SHICHEN_RANGES) {
    if (r.branch === "子") continue;
    if (hour >= r.startHour && hour < r.endHour) return r.branch;
  }
  return "子";
}

/** 日上起时（五鼠遁） */
export function hourStemFromDayStem(
  dayStem: HeavenlyStem,
  hourBranch: EarthlyBranch,
): HeavenlyStem {
  const ziStem = WUSHU_ZI_STEM[dayStem];
  const ziIdx = HEAVENLY_STEMS.indexOf(ziStem);
  const branchIdx = EARTHLY_BRANCHES.indexOf(hourBranch);
  return HEAVENLY_STEMS[(ziIdx + branchIdx) % 10];
}

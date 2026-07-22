import type { Pillar } from "@/lib/types";
import {
  FLAG_NIGHT_ZI,
  FLAG_SHICHEN_UNKNOWN,
  computeRawPillars,
  isNightZiHour,
  parseBirthTime,
  parseSolarDate,
} from "../calendar";

export type BuildPillarsInput = {
  solarDate: string;
  birthTime?: string;
  shichenUnknown?: boolean;
};

export type BuildPillarsResult = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
  dayMaster: string;
  flags: string[];
};

function pillar(stem: string, branch: string): Pillar {
  return { stem, branch };
}

export function buildPillars(input: BuildPillarsInput): BuildPillarsResult {
  const { year, month, day } = parseSolarDate(input.solarDate);
  const flags: string[] = [];

  const unknown =
    input.shichenUnknown === true ||
    input.birthTime == null ||
    input.birthTime === "";

  if (unknown) {
    flags.push(FLAG_SHICHEN_UNKNOWN);
    const raw = computeRawPillars({
      year,
      month,
      day,
      hour: 12,
      minute: 0,
    });
    return {
      year: pillar(raw.yearStem, raw.yearBranch),
      month: pillar(raw.monthStem, raw.monthBranch),
      day: pillar(raw.dayStem, raw.dayBranch),
      hour: null,
      dayMaster: raw.dayStem,
      flags,
    };
  }

  const t = parseBirthTime(input.birthTime!);
  if (!t) {
    throw new Error(`invalid birthTime: ${input.birthTime}`);
  }

  if (isNightZiHour(t.hour)) {
    flags.push(FLAG_NIGHT_ZI);
  }

  const raw = computeRawPillars({
    year,
    month,
    day,
    hour: t.hour,
    minute: t.minute,
  });

  return {
    year: pillar(raw.yearStem, raw.yearBranch),
    month: pillar(raw.monthStem, raw.monthBranch),
    day: pillar(raw.dayStem, raw.dayBranch),
    hour: pillar(raw.hourStem, raw.hourBranch),
    dayMaster: raw.dayStem,
    flags,
  };
}

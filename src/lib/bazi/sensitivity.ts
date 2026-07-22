/**
 * 未知时辰十二候选敏感性（T262）
 */
import { EARTHLY_BRANCHES } from "./calendar/constants";
import { computeRawPillars, parseSolarDate } from "./calendar";
import type { HourSensitivityItem, HourSensitivityReport } from "./policy";

const HOUR_MID: Record<string, number> = {
  子: 0,
  丑: 2,
  寅: 4,
  卯: 6,
  辰: 8,
  巳: 10,
  午: 12,
  未: 14,
  申: 16,
  酉: 18,
  戌: 20,
  亥: 22,
};

/**
 * 对给定公历日，枚举十二时辰候选盘（日柱随夜子时可能变）
 */
export function buildHourSensitivityReport(
  solarDate: string,
): HourSensitivityReport {
  const { year, month, day } = parseSolarDate(solarDate);
  const candidates: HourSensitivityItem[] = [];

  for (const branch of EARTHLY_BRANCHES) {
    const hour = HOUR_MID[branch] ?? 12;
    // 夜子时用 23 点触发 next-day 日柱
    const useHour = branch === "子" ? 23 : hour;
    const raw = computeRawPillars({
      year,
      month,
      day,
      hour: useHour,
      minute: branch === "子" ? 30 : 0,
    });
    const flags: string[] = [];
    if (branch === "子") flags.push("night_zi_candidate");
    candidates.push({
      branch,
      hourStem: raw.hourStem,
      hourBranch: raw.hourBranch,
      dayMaster: raw.dayStem,
      dayStem: raw.dayStem,
      dayBranch: raw.dayBranch,
      flags,
    });
  }

  const dayPillarVariants = [
    ...new Set(candidates.map((c) => c.dayStem + c.dayBranch)),
  ];
  const hourPillarVariants = [
    ...new Set(candidates.map((c) => c.hourStem + c.hourBranch)),
  ];

  return {
    baseDate: solarDate,
    candidates,
    dayPillarVariants,
    hourPillarVariants,
  };
}

/**
 * 简要 diff：各候选日主/时柱差异摘要
 */
export function formatHourSensitivityDiff(report: HourSensitivityReport): string {
  const lines = [
    `基准日 ${report.baseDate}`,
    `日柱变体 ${report.dayPillarVariants.length}：${report.dayPillarVariants.join("、")}`,
    `时柱变体 ${report.hourPillarVariants.length}：${report.hourPillarVariants.join("、")}`,
  ];
  for (const c of report.candidates) {
    lines.push(
      `${c.branch}时 → 日${c.dayStem}${c.dayBranch} 时${c.hourStem}${c.hourBranch}${c.flags.length ? ` [${c.flags.join(",")}]` : ""}`,
    );
  }
  return lines.join("\n");
}

import { describe, expect, it } from "vitest";
import {
  buildHourSensitivityReport,
  formatHourSensitivityDiff,
} from "./sensitivity";

describe("T262 十二时辰敏感性", () => {
  it("枚举 12 候选", () => {
    const report = buildHourSensitivityReport("1990-05-15");
    expect(report.candidates.length).toBe(12);
    expect(report.baseDate).toBe("1990-05-15");
    expect(report.hourPillarVariants.length).toBeGreaterThanOrEqual(10);
  });

  it("夜子时候选日柱可能与早子不同（本实现子时用 23 点）", () => {
    const report = buildHourSensitivityReport("2000-01-01");
    const zi = report.candidates.find((c) => c.branch === "子");
    expect(zi?.flags).toContain("night_zi_candidate");
    expect(report.dayPillarVariants.length).toBeGreaterThanOrEqual(1);
  });

  it("diff 报告可生成", () => {
    const report = buildHourSensitivityReport("1990-05-15");
    const text = formatHourSensitivityDiff(report);
    expect(text).toContain("基准日");
    expect(text).toContain("子时");
  });
});

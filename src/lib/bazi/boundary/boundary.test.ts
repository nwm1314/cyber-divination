import { describe, expect, it } from "vitest";
import { detectBoundaryFlags } from "./index";
import { parseSolarDate } from "../calendar/solar";
import { buildPillars } from "../pillars";
import { computeChart } from "../index";
import type { BirthProfile } from "@/lib/types";

function profile(over: Partial<BirthProfile>): BirthProfile {
  return {
    id: "b-test",
    name: "边界",
    solarDate: "1990-05-15",
    birthTime: "10:30",
    gender: "male",
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...over,
  };
}

describe("T260 历法边界", () => {
  it("拒绝非法日期 2023-02-30", () => {
    expect(() => parseSolarDate("2023-02-30")).toThrow(/invalid solarDate/);
    expect(() => parseSolarDate("2023-13-01")).toThrow();
    expect(() => parseSolarDate("not-a-date")).toThrow();
  });

  it("接受闰年 2/29", () => {
    expect(parseSolarDate("2000-02-29")).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
  });

  it("23 点子时 → night_zi", () => {
    const r = buildPillars({
      solarDate: "2000-01-01",
      birthTime: "23:30",
    });
    expect(r.flags).toContain("night_zi");
    expect(r.hour?.branch).toBe("子");
  });

  it("节气交界 flag", () => {
    // 1990 立夏约 05-06 02:35
    const flags = detectBoundaryFlags({
      solarDate: "1990-05-05",
      birthTime: "20:00",
    });
    expect(flags).toContain("jieqi_boundary");
  });

  it("立春前后 1 分钟四柱可切换", () => {
    const before = computeChart(
      profile({
        id: "lichun-before",
        solarDate: "1990-02-04",
        birthTime: "10:00",
      }),
    );
    const after = computeChart(
      profile({
        id: "lichun-after",
        solarDate: "1990-02-04",
        birthTime: "10:15",
      }),
    );
    expect(before.pillars.year.stem + before.pillars.year.branch).toBe("己巳");
    expect(after.pillars.year.stem + after.pillars.year.branch).toBe("庚午");
    expect(
      before.pillars.year.stem + before.pillars.year.branch !==
        after.pillars.year.stem + after.pillars.year.branch,
    ).toBe(true);
  });

  it("未知时辰 → shichen_unknown + warnings", () => {
    const chart = computeChart(
      profile({ shichenUnknown: true, birthTime: undefined }),
    );
    expect(chart.flags).toContain("shichen_unknown");
    expect(chart.pillars.hour).toBeNull();
    expect(chart.warnings?.some((w) => w.includes("时辰未知"))).toBe(true);
  });

  it("大运交运 startAt 存在", () => {
    const chart = computeChart(profile({}));
    expect(chart.startAgeDetail?.startAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const formal = chart.dayun.filter((d) => !d.isPreDayun);
    expect(formal[0].startAt).toBe(chart.startAgeDetail?.startAt);
  });

  it("meta 含 schema/ruleSet/school/calendarPolicy", () => {
    const chart = computeChart(profile({}));
    expect(chart.meta.schemaVersion).toBeTruthy();
    expect(chart.meta.ruleSetVersion).toBeTruthy();
    expect(chart.meta.school).toBe("ziping-default");
    expect(chart.meta.calendarPolicy?.nightZi).toBe("next_day");
  });
});

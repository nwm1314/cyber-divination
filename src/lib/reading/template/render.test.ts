import { describe, expect, it } from "vitest";
import type { BaziChart } from "@/lib/types";
import { DISCLAIMER, SECTION_KEYS, renderTemplateReading } from "@/lib/reading";

/** mock 盘：不依赖真实引擎 */
export const mockChart: BaziChart = {
  profileId: "mock-profile-1",
  pillars: {
    year: { stem: "甲", branch: "子", tenGod: "正印", hiddenStems: ["癸"] },
    month: { stem: "丙", branch: "寅", tenGod: "食神", hiddenStems: ["甲", "丙", "戊"] },
    day: { stem: "戊", branch: "午", tenGod: "日主", hiddenStems: ["丁", "己"] },
    hour: { stem: "丁", branch: "巳", tenGod: "正印", hiddenStems: ["丙", "庚", "戊"] },
  },
  dayMaster: "戊",
  tenGods: {
    year: "正印",
    month: "食神",
    day: "日主",
    hour: "正印",
  },
  hiddenStems: {
    year: ["癸"],
    month: ["甲", "丙", "戊"],
    day: ["丁", "己"],
    hour: ["丙", "庚", "戊"],
  },
  wuxingScores: {
    wood: 2,
    fire: 4,
    earth: 3,
    metal: 1,
    water: 1,
  },
  relations: {
    stemHe: [],
    branchChong: [],
    branchLiuhe: [],
    branchSanhe: [],
    branchSanhui: [],
    branchXing: [],
    branchHai: [],
  },
  dayun: [
    {
      index: 0,
      stem: "丁",
      branch: "丑",
      startAge: 3,
      endAge: 12,
      startYear: 1993,
      endYear: 2002,
    },
    {
      index: 1,
      stem: "戊",
      branch: "寅",
      startAge: 13,
      endAge: 22,
      startYear: 2003,
      endYear: 2012,
    },
    {
      index: 2,
      stem: "己",
      branch: "卯",
      startAge: 23,
      endAge: 32,
      startYear: 2013,
      endYear: 2022,
    },
    {
      index: 3,
      stem: "庚",
      branch: "辰",
      startAge: 33,
      endAge: 42,
      startYear: 2023,
      endYear: 2032,
    },
  ],
  currentDayunIndex: 3,
  liunian: [
    { year: 2024, stem: "甲", branch: "辰", age: 34 },
    { year: 2025, stem: "乙", branch: "巳", age: 35 },
    { year: 2026, stem: "丙", branch: "午", age: 36 },
  ],
  flags: [],
  meta: { engineVersion: "0.0.0", skillRef: "bazi-skill" },
};

const mockChartNoHour: BaziChart = {
  ...mockChart,
  profileId: "mock-six-char",
  pillars: {
    ...mockChart.pillars,
    hour: null,
  },
};

describe("renderTemplateReading", () => {
  it("返回 ReadingReport 且含 8 个固定 section keys", () => {
    const report = renderTemplateReading(mockChart);
    expect(report.mode).toBe("template");
    expect(report.chartId).toBe("mock-profile-1");
    expect(report.viewMode).toBe("plain");
    expect(report.sections).toHaveLength(8);
    expect(report.sections.map((s) => s.key)).toEqual([...SECTION_KEYS]);
    for (const s of report.sections) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(10);
    }
  });

  it("含 disclaimer 与 3–5 条 calibratePrompts", () => {
    const report = renderTemplateReading(mockChart);
    expect(report.disclaimer).toBe(DISCLAIMER);
    expect(report.disclaimer).toContain("仅供参考");
    expect(report.calibratePrompts.length).toBeGreaterThanOrEqual(3);
    expect(report.calibratePrompts.length).toBeLessThanOrEqual(5);
    // mock 流年最大年 2026 → 校准不得出现 ≥2026 的公元年
    const analysisYear = 2026;
    for (const p of report.calibratePrompts) {
      expect(p.ageRange).toBeTruthy();
      expect(p.yearHint).toBeTruthy();
      expect(p.nature).toBeTruthy();
      const years = p.yearHint.match(/\d{4}/g)?.map(Number) ?? [];
      for (const y of years) {
        expect(y).toBeLessThan(analysisYear);
      }
    }
  });

  it("mock 盘各章节齐全且引用典籍风格", () => {
    const report = renderTemplateReading(mockChart, { viewMode: "pro" });
    const byKey = Object.fromEntries(report.sections.map((s) => [s.key, s]));
    expect(byKey.day_master.body).toContain("戊");
    expect(byKey.ten_gods.body).toContain("六亲");
    expect(byKey.wuxing.body).toMatch(/木|火|土|金|水/);
    expect(byKey.pattern.body).toMatch(/格/);
    expect(byKey.dayun.body).toContain("大运");
    expect(byKey.liunian.body).toContain("2024");
    expect(byKey.calibrate.body).toMatch(/校准|是否/);
    expect(byKey.advice.body).toMatch(/事业|财运|感情|健康/);
    expect(byKey.day_master.citations?.length).toBeGreaterThan(0);
    expect(report.viewMode).toBe("pro");
    expect(byKey.day_master.body).toContain("专业补充");
  });

  it("时辰未知时标注六字盘", () => {
    const report = renderTemplateReading(mockChartNoHour);
    expect(report.sections.find((s) => s.key === "day_master")?.body).toMatch(
      /六字|时辰未填|时辰未知/,
    );
    expect(report.sections.find((s) => s.key === "ten_gods")?.body).toMatch(
      /时辰未填|未知/,
    );
  });

  it("可覆盖 chartId", () => {
    const report = renderTemplateReading(mockChart, { chartId: "custom-id" });
    expect(report.chartId).toBe("custom-id");
  });

  it("T93：同盘改性别，十神六亲与感情建议文案可区分", () => {
    const male = renderTemplateReading(mockChart, {
      viewMode: "plain",
      gender: "male",
    });
    const female = renderTemplateReading(mockChart, {
      viewMode: "plain",
      gender: "female",
    });
    const maleByKey = Object.fromEntries(male.sections.map((s) => [s.key, s]));
    const femaleByKey = Object.fromEntries(
      female.sections.map((s) => [s.key, s]),
    );

    expect(maleByKey.ten_gods.body).toContain("男命");
    expect(maleByKey.ten_gods.body).toMatch(/正财|妻/);
    expect(femaleByKey.ten_gods.body).toContain("女命");
    expect(femaleByKey.ten_gods.body).toMatch(/正官|夫/);

    expect(maleByKey.advice.body).toMatch(/正财|偏财|伴侣/);
    expect(femaleByKey.advice.body).toMatch(/正官|七杀|伴侣/);

    expect(maleByKey.ten_gods.body).not.toBe(femaleByKey.ten_gods.body);
    expect(maleByKey.advice.body).not.toBe(femaleByKey.advice.body);

    // 格局/调候/大运不因性别改写（同盘确定性章节应一致）
    expect(maleByKey.pattern.body).toBe(femaleByKey.pattern.body);
    expect(maleByKey.dayun.body).toBe(femaleByKey.dayun.body);
  });

  it("T93：专业模式六亲亦分性别", () => {
    const male = renderTemplateReading(mockChart, {
      viewMode: "pro",
      gender: "male",
    });
    const female = renderTemplateReading(mockChart, {
      viewMode: "pro",
      gender: "female",
    });
    const mTen = male.sections.find((s) => s.key === "ten_gods")!.body;
    const fTen = female.sections.find((s) => s.key === "ten_gods")!.body;
    expect(mTen).toContain("男命");
    expect(fTen).toContain("女命");
    expect(mTen).not.toBe(fTen);
  });
});

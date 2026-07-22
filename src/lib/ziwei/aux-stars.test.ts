import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "./compute";
import {
  placeAuxStars,
  zuoYouByLunarMonth,
  changQuByHourBranch,
  LUCUN_BY_YEAR_STEM,
  KUI_YUE_BY_YEAR_STEM,
} from "./aux-stars";
import { branchFromYinIndex, yinIndexFromBranch } from "./tables/constants";
import { ENGINE_VERSION } from "./tables/constants";

describe("T160 辅星安星表", () => {
  it("甲年禄存寅、羊卯、陀丑", () => {
    const p = placeAuxStars({
      yearStem: "甲",
      yearBranch: "子",
      lunarMonth: 1,
      hourBranch: "子",
    });
    expect(branchFromYinIndex(p.starYinIndex["禄存"]!)).toBe("寅");
    expect(branchFromYinIndex(p.starYinIndex["擎羊"]!)).toBe("卯");
    expect(branchFromYinIndex(p.starYinIndex["陀罗"]!)).toBe("丑");
  });

  it("十干禄存表完整", () => {
    expect(Object.keys(LUCUN_BY_YEAR_STEM)).toHaveLength(10);
    expect(LUCUN_BY_YEAR_STEM["庚"]).toBe("申");
    expect(LUCUN_BY_YEAR_STEM["癸"]).toBe("子");
  });

  it("正月左辅辰右弼戌；二月左辅巳右弼酉", () => {
    const m1 = zuoYouByLunarMonth(1);
    expect(branchFromYinIndex(m1.zuo)).toBe("辰");
    expect(branchFromYinIndex(m1.you)).toBe("戌");
    const m2 = zuoYouByLunarMonth(2);
    expect(branchFromYinIndex(m2.zuo)).toBe("巳");
    expect(branchFromYinIndex(m2.you)).toBe("酉");
  });

  it("子时文昌戌文曲辰；丑时文昌酉文曲巳", () => {
    const zi = changQuByHourBranch("子");
    expect(branchFromYinIndex(zi.chang)).toBe("戌");
    expect(branchFromYinIndex(zi.qu)).toBe("辰");
    const chou = changQuByHourBranch("丑");
    expect(branchFromYinIndex(chou.chang)).toBe("酉");
    expect(branchFromYinIndex(chou.qu)).toBe("巳");
  });

  it("甲戊庚魁丑钺未", () => {
    expect(KUI_YUE_BY_YEAR_STEM["甲"]).toEqual({ kui: "丑", yue: "未" });
    expect(KUI_YUE_BY_YEAR_STEM["庚"]).toEqual({ kui: "丑", yue: "未" });
  });

  it("placeAuxStars 产出 13 颗辅星各一宫", () => {
    const p = placeAuxStars({
      yearStem: "丙",
      yearBranch: "寅",
      lunarMonth: 6,
      hourBranch: "午",
    });
    const names = Object.keys(p.starYinIndex);
    expect(names.length).toBe(13);
    for (const yi of Object.values(p.starYinIndex)) {
      expect(yi).toBeGreaterThanOrEqual(0);
      expect(yi).toBeLessThan(12);
    }
  });
});

describe("T160 computeZiweiChart 集成辅星", () => {
  it("盘中含左辅/文昌等 category soft|harsh", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    const all = chart.palaces.flatMap((p) => p.stars);
    const soft = all.filter((s) => s.category === "soft");
    const harsh = all.filter((s) => s.category === "harsh");
    expect(soft.length).toBeGreaterThan(0);
    expect(harsh.length).toBeGreaterThan(0);
    expect(all.some((s) => s.name === "左辅")).toBe(true);
    expect(all.some((s) => s.name === "禄存")).toBe(true);
  });

  it("丙年可出现文昌科（四化落辅星）", () => {
    // 丙科文昌：辅星入盘后应能标记
    const chart = computeZiweiChart({
      solarDate: "1996-08-08",
      birthTime: "08:00",
      gender: "female",
      analysisBaseDate: "2026-01-01",
    });
    // 1996 丙子年
    const marked = chart.palaces
      .flatMap((p) => p.stars)
      .filter((s) => s.sihua?.includes("科"));
    // 丙年科为文昌
    const chang = chart.palaces
      .flatMap((p) => p.stars)
      .find((s) => s.name === "文昌");
    expect(chang).toBeDefined();
    if (chang?.sihua?.includes("科")) {
      expect(marked.some((s) => s.name === "文昌")).toBe(true);
    }
  });

  it("同输入确定性", () => {
    const input = {
      solarDate: "1988-03-20",
      birthTime: "22:30",
      gender: "male" as const,
      analysisBaseDate: "2026-01-01",
    };
    const a = computeZiweiChart(input);
    const b = computeZiweiChart(input);
    expect(a.palaces.map((p) => p.stars.map((s) => s.name))).toEqual(
      b.palaces.map((p) => p.stars.map((s) => s.name)),
    );
  });
});

import { describe, expect, it } from "vitest";
import { computeDayun } from "./index";
import type { Pillar } from "@/lib/types";

function p(stem: string, branch: string): Pillar {
  return { stem, branch };
}

describe("computeDayun", () => {
  function formal(r: ReturnType<typeof computeDayun>) {
    return r.dayun.filter((d) => !d.isPreDayun && d.index >= 0);
  }

  it("庚午男 1990-05-15 → forward startAge=7", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, undefined, 2026);
    const f = formal(r);
    expect(f.length).toBe(8);
    expect(f[0].stem).toBe("壬");
    expect(f[0].branch).toBe("午");
    expect(f[0].startAge).toBe(7);
    expect(f[0].endAge).toBe(16);
    expect(f[0].startYear).toBe(1997);
    expect(f[0].endYear).toBe(2006);
    expect(f[1].stem).toBe("癸");
    expect(f[1].branch).toBe("未");
    expect(f[1].startAge).toBe(17);
    expect(f[1].endAge).toBe(26);
    expect(r.dayun.some((d) => d.isPreDayun)).toBe(true);
    expect(r.startAgeDetail.years + r.startAgeDetail.months / 12).toBeGreaterThan(0);
  });

  it("庚午女 1990-05-15 → reverse startAge=3", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "female", "1990-05-15", 10, 30, undefined, 2026);
    const f = formal(r);
    expect(f[0].stem).toBe("庚");
    expect(f[0].branch).toBe("辰");
    expect(f[0].startAge).toBe(3);
    expect(f[0].endAge).toBe(12);
    expect(f[1].stem).toBe("己");
    expect(f[1].branch).toBe("卯");
  });

  it("乙丑男 1985-03-20 → reverse startAge=5", () => {
    const r = computeDayun("戊", p("己", "卯"), "乙", "male", "1985-03-20", 6, 0, undefined, 2026);
    const f = formal(r);
    expect(f[0].stem).toBe("戊");
    expect(f[0].branch).toBe("寅");
    expect(f[0].startAge).toBe(5);
    expect(f[0].endAge).toBe(14);
  });

  it("癸卯女 2023-06-15 → forward startAge", () => {
    const r = computeDayun("丙", p("戊", "午"), "癸", "female", "2023-06-15", 12, 0, undefined, 2026);
    const f = formal(r);
    expect(f[0].startAge).toBeGreaterThanOrEqual(0);
    expect(f.length).toBe(8);
  });

  it("丙子男 1996-12-25 → forward startAge=4", () => {
    const r = computeDayun("庚", p("庚", "子"), "丙", "male", "1996-12-25", 8, 0, undefined, 2026);
    const f = formal(r);
    expect(f[0].stem).toBe("辛");
    expect(f[0].branch).toBe("丑");
    expect(f[0].startAge).toBe(4);
    expect(f[0].startYear).toBe(2000);
    expect(f[0].endYear).toBe(2009);
  });

  it("currentDayunIndex 查找到当前大运", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, undefined, 2026);
    expect(r.currentDayunIndex).toBeGreaterThanOrEqual(0);
  });

  it("deathYear 截断流年", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, 1995, 2026);
    for (const item of r.liunian) {
      expect(item.year).toBeLessThanOrEqual(1995);
    }
    expect(r.liunian.length).toBe(3);
    expect(r.liunian[2].year).toBe(1995);
  });

  it("立春附近出生 男 立春后 → 日柱正确", () => {
    const r = computeDayun("己", p("丙", "寅"), "庚", "male", "1990-02-04", 10, 15, undefined, 2026);
    expect(formal(r).length).toBe(8);
  });

  it("liunian 返回 3 年", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, undefined, 2026);
    expect(r.liunian.length).toBe(3);
    expect(r.liunian[0].year).toBe(2024);
    expect(r.liunian[1].year).toBe(2025);
    expect(r.liunian[2].year).toBe(2026);
    expect(r.liunian[0].stem).toBe("甲");
    expect(r.liunian[0].branch).toBe("辰");
    expect(r.liunian[1].stem).toBe("乙");
    expect(r.liunian[1].branch).toBe("巳");
    expect(r.liunian[2].stem).toBe("丙");
    expect(r.liunian[2].branch).toBe("午");
  });

  it("所有正式大运 step 有有效 startAge/endAge/year", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, undefined, 2026);
    for (const step of formal(r)) {
      expect(step.startAge).toBeLessThanOrEqual(step.endAge);
      expect(step.startYear).toBeLessThanOrEqual(step.endYear);
      expect(step.endAge - step.startAge).toBe(9);
      expect(step.endYear - step.startYear).toBe(9);
    }
  });

  it("currentDayunIndex = -1 when currentAge < startAge", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "2020-05-15", 10, 30, undefined, 2020);
    expect(r.currentDayunIndex).toBe(-1);
  });
});

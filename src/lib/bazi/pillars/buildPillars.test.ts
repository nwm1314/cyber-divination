import { describe, expect, it } from "vitest";
import { buildPillars } from "./buildPillars";
import {
  FLAG_NIGHT_ZI,
  FLAG_SHICHEN_UNKNOWN,
  hourStemFromDayStem,
  WUSHU_ZI_STEM,
} from "../calendar";

function gz(p: { stem: string; branch: string }) {
  return p.stem + p.branch;
}

describe("buildPillars", () => {
  it("1990-05-15 10:30 → 庚午 辛巳 庚辰 辛巳", () => {
    const r = buildPillars({
      solarDate: "1990-05-15",
      birthTime: "10:30",
    });
    expect(gz(r.year)).toBe("庚午");
    expect(gz(r.month)).toBe("辛巳");
    expect(gz(r.day)).toBe("庚辰");
    expect(r.hour && gz(r.hour)).toBe("辛巳");
    expect(r.dayMaster).toBe("庚");
    expect(r.flags).not.toContain(FLAG_NIGHT_ZI);
  });

  it("时辰未知 → hour null + flag", () => {
    const r = buildPillars({
      solarDate: "1990-05-15",
      shichenUnknown: true,
    });
    expect(r.hour).toBeNull();
    expect(gz(r.year)).toBe("庚午");
    expect(gz(r.day)).toBe("庚辰");
    expect(r.flags).toContain(FLAG_SHICHEN_UNKNOWN);
  });

  it("无 birthTime → hour null", () => {
    const r = buildPillars({ solarDate: "2010-10-10" });
    expect(r.hour).toBeNull();
    expect(r.flags).toContain(FLAG_SHICHEN_UNKNOWN);
  });

  it("夜子时 23:30：日柱用次日 + flag", () => {
    const r = buildPillars({
      solarDate: "2000-01-01",
      birthTime: "23:30",
    });
    expect(r.flags).toContain(FLAG_NIGHT_ZI);
    expect(gz(r.day)).toBe("己未");
    expect(r.hour && gz(r.hour)).toBe("甲子");
    expect(gz(r.year)).toBe("己卯");
    expect(gz(r.month)).toBe("丙子");
  });

  it("早子时 00:30：当日日柱", () => {
    const r = buildPillars({
      solarDate: "2000-01-02",
      birthTime: "00:30",
    });
    expect(r.flags).not.toContain(FLAG_NIGHT_ZI);
    expect(gz(r.day)).toBe("己未");
    expect(r.hour && gz(r.hour)).toBe("甲子");
  });

  it("立春分年：1990-02-04 立春前丑月己巳年 / 立春后寅月庚午年", () => {
    const before = buildPillars({
      solarDate: "1990-02-04",
      birthTime: "10:00",
    });
    expect(gz(before.year)).toBe("己巳");
    expect(gz(before.month)).toBe("丁丑");

    const after = buildPillars({
      solarDate: "1990-02-04",
      birthTime: "10:15",
    });
    expect(gz(after.year)).toBe("庚午");
    expect(gz(after.month)).toBe("戊寅");
  });

  it("2023 立春前后年柱", () => {
    const before = buildPillars({
      solarDate: "2023-01-21",
      birthTime: "12:00",
    });
    expect(gz(before.year)).toBe("壬寅");
    expect(gz(before.month)).toBe("癸丑");

    const after = buildPillars({
      solarDate: "2023-02-04",
      birthTime: "12:00",
    });
    expect(gz(after.year)).toBe("癸卯");
    expect(gz(after.month)).toBe("甲寅");
  });

  it("五鼠遁：日干庚 → 子时丙", () => {
    expect(WUSHU_ZI_STEM["庚"]).toBe("丙");
    expect(hourStemFromDayStem("庚", "子")).toBe("丙");
    expect(hourStemFromDayStem("庚", "巳")).toBe("辛");
    const r = buildPillars({
      solarDate: "1990-05-15",
      birthTime: "10:30",
    });
    expect(r.day.stem).toBe("庚");
    expect(r.hour?.stem).toBe("辛");
    expect(r.hour?.branch).toBe("巳");
  });
});

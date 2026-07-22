import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "../compute";
import { ENGINE_VERSION } from "../tables/constants";
import { FLAG_YUN_FEIXING } from "./index";

describe("运限飞星叠盘（T200/T201）", () => {
  const chart = computeZiweiChart({
    solarDate: "1990-05-15",
    birthTime: "10:00",
    gender: "male",
    analysisBaseDate: "2024-01-01",
  });

  it("engine 0.8.0 + flag + agePolicy xusui", () => {
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toBe("0.8.0");
    expect(chart.meta.agePolicy).toBe("xusui");
    expect(chart.flags).toContain(FLAG_YUN_FEIXING);
  });

  it("大限步含宫干与四化飞出", () => {
    expect(chart.daxian.length).toBe(12);
    const withStem = chart.daxian.filter((s) => s.stem);
    expect(withStem.length).toBe(12);
    const withSihua = chart.daxian.filter((s) => (s.sihuaOut?.length ?? 0) > 0);
    expect(withSihua.length).toBeGreaterThan(0);
    const step = withSihua[0]!;
    expect(step.sihuaOut!.length).toBeLessThanOrEqual(4);
    for (const x of step.sihuaOut!) {
      expect(["禄", "权", "科", "忌"]).toContain(x.kind);
      expect(x.star.length).toBeGreaterThan(0);
      expect(x.toPalace.length).toBeGreaterThan(0);
    }
  });

  it("流年含干、四化、流昌流曲宫", () => {
    expect(chart.liunian?.length).toBeGreaterThan(0);
    for (const n of chart.liunian!) {
      expect(n.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/);
      expect(n.sihuaOut?.length).toBeGreaterThan(0);
      expect(n.liuChangPalace).toBeTruthy();
      expect(n.liuQuPalace).toBeTruthy();
    }
  });

  it("运限不污染本命星 sihua 的「大限·」前缀写回", () => {
    // 本命星上不应出现「大限·」飞入标记（仅运限层字段）
    for (const p of chart.palaces) {
      for (const s of p.stars) {
        expect(s.sihua?.some((m) => m.startsWith("大限·"))).toBeFalsy();
        expect(s.sihua?.some((m) => m.startsWith("流年·"))).toBeFalsy();
        expect(s.sihua?.some((m) => m.startsWith("流月·"))).toBeFalsy();
        expect(s.sihua?.some((m) => m.startsWith("流日·"))).toBeFalsy();
      }
    }
  });

  it("T240：流月/流日可复现且含干四化", () => {
    expect(chart.liuyue?.length).toBe(3);
    expect(chart.liuri?.length).toBe(3);
    expect(chart.flags).toContain("liuyue_by_month_gz");
    expect(chart.flags).toContain("liuri_by_day_gz");
    for (const n of chart.liuyue!) {
      expect(n.month).toMatch(/^\d{4}-\d{2}$/);
      expect(n.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/);
      expect(n.sihuaOut?.length).toBeGreaterThan(0);
    }
    for (const n of chart.liuri!) {
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.stem).toMatch(/^[甲乙丙丁戊己庚辛壬癸]$/);
      expect(n.sihuaOut?.length).toBeGreaterThan(0);
    }
    const again = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2024-01-01",
    });
    expect(again.liuyue).toEqual(chart.liuyue);
    expect(again.liuri).toEqual(chart.liuri);
  });
});

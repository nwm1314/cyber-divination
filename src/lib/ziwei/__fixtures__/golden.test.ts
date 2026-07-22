import { describe, expect, it } from "vitest";
import { computeZiweiChart, ENGINE_VERSION, SKILL_REF } from "../index";
import { ziweiGoldenCases } from "./golden-cases";

describe("ziwei golden cases · T103", () => {
  it("金标准 ≥8 例", () => {
    expect(ziweiGoldenCases.length).toBeGreaterThanOrEqual(8);
  });

  for (const c of ziweiGoldenCases) {
    it(c.label, () => {
      const chart = computeZiweiChart(c.input);

      expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
      expect(chart.meta.skillRef).toBe(SKILL_REF);
      expect(chart.palaces).toHaveLength(12);

      // 命宫
      expect(chart.palaces[0].name).toBe("命宫");
      expect(chart.palaces[0].branch).toBe(c.mingBranch);
      expect(chart.mingGong).toBe("命宫");

      // 身宫
      expect(chart.shenGong).toBe(c.shenGong);
      const shen = chart.palaces.find((p) => p.isShenGong);
      expect(shen?.branch).toBe(c.shenBranch);
      expect(shen?.name).toBe(c.shenGong);

      // 五行局
      expect(chart.wuxingJu).toBe(c.wuxingJu);

      // 十四主星
      const majors: Record<string, string> = {};
      for (const p of chart.palaces) {
        for (const s of p.stars) {
          if (s.category === "major") majors[s.name] = p.branch;
        }
      }
      expect(Object.keys(majors).sort()).toEqual(
        Object.keys(c.majorByBranch).sort(),
      );
      for (const [name, branch] of Object.entries(c.majorByBranch)) {
        expect(majors[name]).toBe(branch);
      }

      // 大限：12 步 + 首/次步
      expect(chart.daxian).toHaveLength(12);
      expect(chart.daxian[0]).toMatchObject(c.daxian0);
      expect(chart.daxian[1]).toMatchObject(c.daxian1);

      // T270 policy
      expect(chart.meta.agePolicy).toBe("xusui");
      expect(chart.meta.school).toBe("sanhe");
      expect(c.source).toBeTruthy();
      expect(c.engineVersionAtCapture).toBeTruthy();
    });
  }

  it("同输入 deep equal（金标准 g1）", () => {
    const a = computeZiweiChart(ziweiGoldenCases[0].input);
    const b = computeZiweiChart(ziweiGoldenCases[0].input);
    expect(a).toEqual(b);
  });

  it("g1–g8 主星与 majorStars 索引一致", () => {
    for (const c of ziweiGoldenCases) {
      const chart = computeZiweiChart(c.input);
      for (const [pname, stars] of Object.entries(chart.majorStars)) {
        const palace = chart.palaces.find((p) => p.name === pname)!;
        const fromPalace = palace.stars
          .filter((s) => s.category === "major")
          .map((s) => s.name)
          .sort();
        expect([...stars].sort()).toEqual(fromPalace);
      }
    }
  });
});

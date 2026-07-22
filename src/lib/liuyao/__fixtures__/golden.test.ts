import { describe, expect, it } from "vitest";
import { castLiuyao, LIUYAO_ENGINE_VERSION } from "../cast";
import { analyzeLiuyao, listDongYao } from "../analyze";
import { liuyaoGoldenCases, LIUYAO_GOLDEN_META } from "./golden-cases";

describe("liuyao golden cases · T113 + T282", () => {
  it("fixture 元数据含来源流派版本", () => {
    expect(LIUYAO_GOLDEN_META.source).toBeTruthy();
    expect(LIUYAO_GOLDEN_META.school).toMatch(/najia|jingfang/);
    expect(LIUYAO_GOLDEN_META.dataVersion).toMatch(/^liuyao-data-/);
    expect(LIUYAO_GOLDEN_META.ruleSetVersion).toBeTruthy();
    expect(LIUYAO_GOLDEN_META.references.length).toBeGreaterThan(0);
  });

  it("用例数 ≥ 8", () => {
    expect(liuyaoGoldenCases.length).toBeGreaterThanOrEqual(8);
  });

  it("覆盖 manual / 世应 / 动变", () => {
    const tags = new Set(liuyaoGoldenCases.flatMap((c) => c.tags));
    expect(tags.has("manual")).toBe(true);
    expect(tags.has("shi-ying")).toBe(true);
    expect(tags.has("changing") || tags.has("multi-changing")).toBe(true);
  });

  for (const c of liuyaoGoldenCases) {
    it(c.label, () => {
      const chart = castLiuyao(c.input);
      const analysis = analyzeLiuyao(chart);

      expect(chart.meta.engineVersion).toBe(LIUYAO_ENGINE_VERSION);
      expect(chart.method).toBe("manual");
      expect(chart.lines).toHaveLength(6);
      expect(chart.benGua).toEqual(c.expect.benGua);
      expect(chart.shiYao).toBe(c.expect.shiYao);
      expect(chart.yingYao).toBe(c.expect.yingYao);
      expect(chart.yongShen).toBe(c.expect.yongShen);
      expect(listDongYao(chart)).toEqual([...c.expect.dongYao]);
      expect(analysis.palace).toBe(c.expect.palace);
      expect(analysis.palacePos).toBe(c.expect.palacePos);

      if (c.expect.bianGua) {
        expect(chart.bianGua).toEqual(c.expect.bianGua);
        expect(chart.lines.some((l) => l.changing)).toBe(true);
      } else {
        expect(chart.bianGua).toBeUndefined();
        expect(chart.lines.every((l) => !l.changing)).toBe(true);
      }

      for (let i = 0; i < 6; i++) {
        expect(chart.lines[i]!.yao).toBe(i + 1);
        expect(chart.lines[i]!.value).toBe(c.input.lines[i]);
        expect(chart.lines[i]!.changing).toBe(
          c.input.lines[i] === 6 || c.input.lines[i] === 9,
        );
      }
    });
  }

  it("manual 同输入 deep equal（ly-g1）", () => {
    const input = liuyaoGoldenCases[0]!.input;
    expect(castLiuyao(input)).toEqual(castLiuyao(input));
  });

  it("manual 同输入 deep equal（含动变 ly-g9）", () => {
    const input = liuyaoGoldenCases.find((c) => c.id === "ly-g9")!.input;
    expect(castLiuyao(input)).toEqual(castLiuyao(input));
  });
});

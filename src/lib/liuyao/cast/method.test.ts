import { describe, expect, it } from "vitest";
import { castLiuyao, LIUYAO_ENGINE_VERSION } from "./index";
import {
  CASTING_SCHOOL_BY_METHOD,
  castingSchoolOf,
  methodNoteOf,
  randomSourceOf,
} from "./method";

describe("T280 起卦方法与流派标识", () => {
  it("method → castingSchool 映射", () => {
    expect(CASTING_SCHOOL_BY_METHOD.coins).toBe("najia-coins");
    expect(CASTING_SCHOOL_BY_METHOD.manual).toBe("najia-manual");
    expect(CASTING_SCHOOL_BY_METHOD.time).toBe("meihua-time-to-najia");
    expect(castingSchoolOf("time")).toBe("meihua-time-to-najia");
  });

  it("时间法 methodNote 标明梅花混合，不伪装纯纳甲", () => {
    const note = methodNoteOf("time");
    expect(note).toMatch(/梅花/);
    expect(note).toMatch(/混合|非纯/);
  });

  it("铜钱写入 replaySeed 与 randomSource", () => {
    const chart = castLiuyao({
      question: "复盘铜钱",
      method: "coins",
      seed: 42,
      id: "t280-coins",
    });
    expect(chart.meta.engineVersion).toBe(LIUYAO_ENGINE_VERSION);
    expect(chart.meta.castingSchool).toBe("najia-coins");
    expect(chart.meta.randomSource).toBe("seeded-prng");
    expect(chart.meta.replaySeed).toBe(42);
    expect(chart.meta.timezone).toBeTruthy();
    expect(chart.meta.methodNote).toMatch(/三钱|纳甲/);
  });

  it("铜钱无 seed 为 fresh-seed 且仍有 replaySeed", () => {
    const chart = castLiuyao({
      question: "新鲜种子",
      method: "coins",
      id: "t280-fresh",
    });
    expect(chart.meta.randomSource).toBe("fresh-seed");
    expect(chart.meta.replaySeed).toBeDefined();
  });

  it("时间法 castingSchool=meihua-time-to-najia", () => {
    const chart = castLiuyao({
      question: "时间混合",
      method: "time",
      datetime: "2024-06-15T10:30",
      timezone: "Asia/Shanghai",
      id: "t280-time",
    });
    expect(chart.meta.castingSchool).toBe("meihua-time-to-najia");
    expect(chart.meta.randomSource).toBe("none");
    expect(chart.meta.timezone).toBe("Asia/Shanghai");
    expect(chart.meta.methodNote).toMatch(/梅花|混合/);
  });

  it("手动 randomSource=none", () => {
    const chart = castLiuyao({
      question: "手动",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t280-manual",
    });
    expect(chart.meta.castingSchool).toBe("najia-manual");
    expect(chart.meta.randomSource).toBe("none");
    expect(chart.meta.replaySeed).toBeUndefined();
  });

  it("randomSourceOf 辅助", () => {
    expect(randomSourceOf("manual", {})).toBe("none");
    expect(randomSourceOf("coins", { seedProvided: true })).toBe("seeded-prng");
    expect(randomSourceOf("coins", { seedProvided: false })).toBe("fresh-seed");
  });
});

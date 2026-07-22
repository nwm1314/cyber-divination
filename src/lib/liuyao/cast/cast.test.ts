import { describe, expect, it } from "vitest";
import {
  castLiuyao,
  castCoinsLines,
  castTimeLines,
  LIUYAO_ENGINE_VERSION,
  toBinary,
  yearBranchNum,
  hourToShichen,
} from "./index";

describe("castLiuyao · manual", () => {
  it("手动六爻可复现，全少阳为本卦乾", () => {
    const a = castLiuyao({
      question: "今日事宜",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t-manual-qian",
    });
    const b = castLiuyao({
      question: "今日事宜",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t-manual-qian",
    });
    expect(a).toEqual(b);
    expect(a.method).toBe("manual");
    expect(a.benGua).toEqual({ name: "乾为天", upper: "乾", lower: "乾" });
    expect(a.bianGua).toBeUndefined();
    expect(a.lines.every((l) => !l.changing)).toBe(true);
    expect(a.shiYao).toBe(6);
    expect(a.yingYao).toBe(3);
    expect(a.yongShen).toBeDefined();
    expect(a.meta.engineVersion).toBe(LIUYAO_ENGINE_VERSION);
  });

  it("初爻老阳 → 变卦下巽上乾（天风）", () => {
    const chart = castLiuyao({
      question: "测变卦",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
    });
    expect(chart.lines[0]).toMatchObject({ yao: 1, value: 9, changing: true });
    expect(chart.benGua).toEqual({ name: "乾为天", upper: "乾", lower: "乾" });
    expect(chart.bianGua).toEqual({
      name: "天风姤",
      upper: "乾",
      lower: "巽",
    });
    expect(toBinary([9, 7, 7, 7, 7, 7])).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("老阴动 → 变阳", () => {
    const chart = castLiuyao({
      question: "坤变",
      method: "manual",
      lines: [6, 8, 8, 8, 8, 8],
    });
    expect(chart.benGua.lower).toBe("坤");
    expect(chart.benGua.upper).toBe("坤");
    expect(chart.bianGua?.lower).toBe("震");
    expect(chart.bianGua?.upper).toBe("坤");
  });

  it("非法爻值抛错", () => {
    expect(() =>
      castLiuyao({
        question: "x",
        method: "manual",
        lines: [5, 7, 7, 7, 7, 7],
      }),
    ).toThrow(/非法爻值/);
  });

  it("缺 lines 抛错", () => {
    expect(() =>
      castLiuyao({ question: "x", method: "manual" }),
    ).toThrow(/lines/);
  });
});

describe("castLiuyao · coins", () => {
  it("相同 seed 六爻一致", () => {
    const seed = 42;
    const a = castLiuyao({
      question: "铜钱复现",
      method: "coins",
      seed,
      id: "c1",
    });
    const b = castLiuyao({
      question: "铜钱复现",
      method: "coins",
      seed,
      id: "c1",
    });
    expect(a.lines).toEqual(b.lines);
    expect(a.benGua).toEqual(b.benGua);
    expect(a.method).toBe("coins");
    expect(a.lines).toHaveLength(6);
    for (const line of a.lines) {
      expect([6, 7, 8, 9]).toContain(line.value);
      expect(line.changing).toBe(line.value === 6 || line.value === 9);
    }
  });

  it("字符串 seed 亦可复现", () => {
    const lines1 = castCoinsLines("cyber-divination");
    const lines2 = castCoinsLines("cyber-divination");
    expect(lines1).toEqual(lines2);
    expect(lines1).toHaveLength(6);
  });

  it("不同 seed 通常不同（抽样）", () => {
    const a = castCoinsLines(1);
    const b = castCoinsLines(2);
    expect(a).not.toEqual(b);
  });
});

describe("castLiuyao · time", () => {
  it("相同 datetime 可复现", () => {
    const a = castLiuyao({
      question: "时间起卦",
      method: "time",
      datetime: "2024-06-15T10:30",
      id: "t1",
    });
    const b = castLiuyao({
      question: "时间起卦",
      method: "time",
      datetime: "2024-06-15T10:30",
      id: "t1",
    });
    expect(a).toEqual(b);
    expect(a.method).toBe("time");
    expect(a.lines).toHaveLength(6);
    const changing = a.lines.filter((l) => l.changing);
    expect(changing).toHaveLength(1);
  });

  it("time 字段与 datetime 一致路径", () => {
    const viaParts = castLiuyao({
      question: "parts",
      method: "time",
      time: { year: 2024, month: 6, day: 15, hour: 10 },
      id: "p1",
    });
    const viaDt = castLiuyao({
      question: "parts",
      method: "time",
      datetime: "2024-06-15T10:00",
      id: "p1",
    });
    expect(viaParts.lines).toEqual(viaDt.lines);
    expect(viaParts.benGua).toEqual(viaDt.benGua);
  });

  it("梅花动爻唯一且为 6 或 9", () => {
    const values = castTimeLines({
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
    });
    const changing = values.filter((v) => v === 6 || v === 9);
    expect(changing).toHaveLength(1);
  });

  it("yearBranchNum / hourToShichen 边界", () => {
    expect(yearBranchNum(2020)).toBe(1);
    expect(hourToShichen(23)).toBe(1);
    expect(hourToShichen(0)).toBe(1);
    expect(hourToShichen(1)).toBe(2);
    expect(hourToShichen(10)).toBe(6);
  });

  it("缺时间参数抛错", () => {
    expect(() =>
      castLiuyao({ question: "x", method: "time" }),
    ).toThrow(/datetime|time/);
  });
});

describe("castLiuyao · 通用", () => {
  it("空 question 抛错", () => {
    expect(() =>
      castLiuyao({
        question: "  ",
        method: "manual",
        lines: [7, 7, 7, 7, 7, 7],
      }),
    ).toThrow(/question/);
  });
});

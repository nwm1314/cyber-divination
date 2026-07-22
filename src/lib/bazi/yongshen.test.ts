import { describe, expect, it } from "vitest";
import { computeChart, countTenGodsByPosition, estimateStrength } from "./index";
import type { BirthProfile, BaziChart } from "@/lib/types";

function profile(over?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "ys-test",
    name: "用神",
    solarDate: "1990-05-15",
    birthTime: "10:30",
    gender: "male",
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...over,
  };
}

describe("T261 旺衰与用神", () => {
  it("重复天干按位置分别计数（庚午/辛巳/庚辰/辛巳 有两庚两辛）", () => {
    const chart = computeChart(profile());
    // 年庚 月辛 日庚 时辛
    expect(chart.tenGodsByPosition?.length).toBe(4);
    const stems = chart.tenGodsByPosition!.map((t) => t.stem);
    expect(stems.filter((s) => s === "庚").length).toBe(2);
    expect(stems.filter((s) => s === "辛").length).toBe(2);

    // Record 合并后只有 2 个 key，但按位计数 support 应 > 1
    const { support, drain } = countTenGodsByPosition(chart);
    // 月辛劫财 + 时辛劫财 = support 2；年庚是比肩也算 support
    // day 位跳过
    expect(support).toBeGreaterThanOrEqual(2);
    expect(support + drain).toBe(3); // 年+月+时
  });

  it("tenGods Record 仍兼容查表", () => {
    const chart = computeChart(profile());
    expect(chart.tenGods["庚"]).toBe("比肩");
    expect(chart.tenGods["辛"]).toBe("劫财");
  });

  it("wuxingScoresVisual 与 wuxingScores 一致且标注可视化", () => {
    const chart = computeChart(profile());
    expect(chart.wuxingScoresVisual).toEqual(chart.wuxingScores);
    expect(
      chart.evidence?.some((e) => e.ruleId === "wuxing.visual_weights.v1"),
    ).toBe(true);
  });

  it("用神分层 + evidence 输出", () => {
    const chart = computeChart(profile());
    expect(chart.yongshenLayered).toBeDefined();
    expect(chart.yongshenLayered!.fuyi.favorable.length).toBeGreaterThan(0);
    expect(chart.yongshenLayered!.tiaohou).toBeDefined();
    expect(chart.yongshenLayered!.tongguan).toBeDefined();
    expect(chart.yongshenLayered!.bingyao).toBeDefined();
    expect(chart.evidence?.length).toBeGreaterThan(2);
    for (const e of chart.evidence!) {
      expect(e.ruleId).toBeTruthy();
      expect(e.source).toBeTruthy();
      expect(e.conclusion).toBeTruthy();
      expect(e.confidence).toBeGreaterThan(0);
    }
  });

  it("边界：仅三柱时按位置计数不崩", () => {
    const chart = computeChart(
      profile({ shichenUnknown: true, birthTime: undefined }),
    );
    expect(chart.tenGodsByPosition?.length).toBe(3);
    const c = countTenGodsByPosition(chart);
    expect(c.support + c.drain).toBe(2);
    expect(estimateStrength(chart)).toBeTruthy();
  });

  it("手工构造重复比肩：Record 合并 vs 位置计数", () => {
    const chart: BaziChart = {
      profileId: "dup",
      dayMaster: "甲",
      pillars: {
        year: { stem: "甲", branch: "子", tenGod: "比肩" },
        month: { stem: "甲", branch: "寅", tenGod: "比肩" },
        day: { stem: "甲", branch: "辰", tenGod: "比肩" },
        hour: { stem: "甲", branch: "午", tenGod: "比肩" },
      },
      tenGods: { 甲: "比肩" }, // 合并后仅 1
      tenGodsByPosition: [
        { position: "year", stem: "甲", tenGod: "比肩" },
        { position: "month", stem: "甲", tenGod: "比肩" },
        { position: "day", stem: "甲", tenGod: "比肩" },
        { position: "hour", stem: "甲", tenGod: "比肩" },
      ],
      hiddenStems: {},
      wuxingScores: { wood: 5, fire: 1, earth: 1, metal: 0.5, water: 1 },
      relations: {
        stemHe: [],
        branchChong: [],
        branchLiuhe: [],
        branchSanhe: [],
        branchSanhui: [],
        branchXing: [],
        branchHai: [],
      },
      dayun: [],
      currentDayunIndex: -1,
      liunian: [],
      flags: [],
      meta: { engineVersion: "0.3.0", skillRef: "bazi-skill" },
    };
    const { support } = countTenGodsByPosition(chart);
    expect(support).toBe(3); // year+month+hour
    expect(Object.keys(chart.tenGods).length).toBe(1);
  });
});

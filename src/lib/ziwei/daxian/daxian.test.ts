import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "../compute";
import {
  computeDaxian,
  daxianBranch,
  daxianDirection,
  daxianPalaceName,
  startAgeFromJu,
  FLAG_DEATH_CLAMP,
  FLAG_DAXIAN_SANHE,
} from "./index";
import type { ZiweiPalace } from "@/lib/types/ziwei";
import { PALACE_NAMES } from "../tables/constants";

function mockPalaces(mingBranch: "子" | "寅" = "子"): ZiweiPalace[] {
  // 命宫落 mingBranch，逆布十二宫（与 buildTwelvePalaces 同序）
  const dizhi = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ] as const;
  const mingIdx = dizhi.indexOf(mingBranch);
  return PALACE_NAMES.map((name, nameIdx) => {
    // 命宫 nameIdx=0 → mingBranch；兄弟 nameIdx=1 → 逆一宫
    const b = dizhi[(mingIdx - nameIdx + 12) % 12];
    return {
      name,
      branch: b,
      stars: [],
    };
  });
}

describe("daxianDirection / startAgeFromJu", () => {
  it("阳男顺、阴男逆、阴女顺、阳女逆", () => {
    expect(daxianDirection("庚", "male")).toBe("forward");
    expect(daxianDirection("乙", "male")).toBe("reverse");
    expect(daxianDirection("乙", "female")).toBe("forward");
    expect(daxianDirection("庚", "female")).toBe("reverse");
  });

  it("局数起运", () => {
    expect(startAgeFromJu("水二局")).toBe(2);
    expect(startAgeFromJu("木三局")).toBe(3);
    expect(startAgeFromJu("金四局")).toBe(4);
    expect(startAgeFromJu("土五局")).toBe(5);
    expect(startAgeFromJu("火六局")).toBe(6);
  });
});

describe("daxianPalaceName / branch", () => {
  it("顺行：命→父母→福德", () => {
    expect(daxianPalaceName(0, "forward")).toBe("命宫");
    expect(daxianPalaceName(1, "forward")).toBe("父母");
    expect(daxianPalaceName(2, "forward")).toBe("福德");
  });

  it("逆行：命→兄弟→夫妻", () => {
    expect(daxianPalaceName(0, "reverse")).toBe("命宫");
    expect(daxianPalaceName(1, "reverse")).toBe("兄弟");
    expect(daxianPalaceName(2, "reverse")).toBe("夫妻");
  });

  it("命宫子 · 顺行地支 子丑寅", () => {
    expect(daxianBranch("子", 0, "forward")).toBe("子");
    expect(daxianBranch("子", 1, "forward")).toBe("丑");
    expect(daxianBranch("子", 2, "forward")).toBe("寅");
  });

  it("命宫子 · 逆行地支 子亥戌", () => {
    expect(daxianBranch("子", 0, "reverse")).toBe("子");
    expect(daxianBranch("子", 1, "reverse")).toBe("亥");
    expect(daxianBranch("子", 2, "reverse")).toBe("戌");
  });
});

describe("computeDaxian", () => {
  const base = {
    palaces: mockPalaces("子"),
    mingYinIndex: 10, // 子
    yearStem: "庚" as const,
    gender: "male" as const,
    wuxingJu: "火六局",
    birthYear: 1990,
    baseYear: 2026,
  };

  it("12 步 · 火六起 6 岁 · 阳男顺", () => {
    const r = computeDaxian(base);
    expect(r.startAge).toBe(6);
    expect(r.direction).toBe("forward");
    expect(r.daxian).toHaveLength(12);
    expect(r.daxian[0]).toMatchObject({
      index: 0,
      startAge: 6,
      endAge: 15,
      palace: "命宫",
      branch: "子",
    });
    expect(r.daxian[1]).toMatchObject({
      startAge: 16,
      endAge: 25,
      palace: "父母",
      branch: "丑",
    });
    // 虚岁 2026-1990+1=37 → 第 4 限 36–45
    expect(r.currentDaxianIndex).toBe(3);
    expect(r.daxian[3].palace).toBe("田宅");
    expect(r.flags).toContain(FLAG_DAXIAN_SANHE);
    expect(r.flags).toContain("daxian_age_xusui");
  });

  it("童限：未起运 currentDaxianIndex=-1", () => {
    // 虚岁 1993-1990+1=4 < 6
    const r = computeDaxian({ ...base, baseYear: 1993 });
    expect(r.currentDaxianIndex).toBe(-1);
    expect(r.liunian.map((x) => x.year)).toEqual([1991, 1992, 1993]);
  });

  it("阴男逆行", () => {
    const r = computeDaxian({
      ...base,
      yearStem: "乙",
      gender: "male",
    });
    expect(r.direction).toBe("reverse");
    expect(r.daxian[0].palace).toBe("命宫");
    expect(r.daxian[1].palace).toBe("兄弟");
    expect(r.daxian[1].branch).toBe("亥");
  });

  it("已故截断：流年止于 deathYear，当前限按卒年计", () => {
    const r = computeDaxian({
      ...base,
      baseYear: 2026,
      alive: false,
      deathYear: 2005,
    });
    // 虚岁 at 2005 = 2005-1990+1=16 → 次限 16–25
    expect(r.currentDaxianIndex).toBe(1);
    expect(r.liunian.map((x) => x.year)).toEqual([2003, 2004, 2005]);
    expect(r.liunian.every((x) => x.year <= 2005)).toBe(true);
    expect(r.flags).toContain(FLAG_DEATH_CLAMP);
  });

  it("流年按年支落宫 · 虚岁", () => {
    const r = computeDaxian(base);
    expect(r.liunian).toHaveLength(3);
    for (const item of r.liunian) {
      expect(item.branch).toBeTruthy();
      expect(item.palace).toBeTruthy();
      const p = base.palaces.find((x) => x.name === item.palace);
      expect(p?.branch).toBe(item.branch);
      expect(item.age).toBe(item.year - 1990 + 1);
    }
  });

  it("确定性", () => {
    const a = computeDaxian(base);
    const b = computeDaxian(base);
    expect(a).toEqual(b);
  });
});

describe("computeZiweiChart · daxian 集成", () => {
  it("填充 daxian / liunian / currentDaxianIndex", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2026-07-20",
    });
    expect(chart.daxian).toHaveLength(12);
    expect(chart.daxian[0].startAge).toBe(6); // 火六
    expect(chart.currentDaxianIndex).toBeGreaterThanOrEqual(0);
    expect(chart.liunian?.length).toBe(3);
    expect(chart.liunian?.map((x) => x.year)).toEqual([2024, 2025, 2026]);
    expect(chart.flags).toContain(FLAG_DAXIAN_SANHE);
  });

  it("基准日改变 → 当前限/流年变", () => {
    const a = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2000-01-01",
    });
    const b = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2026-07-20",
    });
    // 虚岁 2000→11 首限；2026→37 第4限
    expect(a.currentDaxianIndex).toBe(0);
    expect(b.currentDaxianIndex).toBe(3);
    expect(a.liunian?.at(-1)?.year).toBe(2000);
    expect(b.liunian?.at(-1)?.year).toBe(2026);
  });

  it("已故边界", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2026-07-20",
      alive: false,
      deathYear: 1998,
    });
    // 虚岁 1998-1990+1=9 → 仍在首限 6–15
    expect(chart.currentDaxianIndex).toBe(0);
    expect(chart.liunian?.every((x) => x.year <= 1998)).toBe(true);
    expect(chart.liunian?.at(-1)?.year).toBe(1998);
    expect(chart.flags).toContain(FLAG_DEATH_CLAMP);
  });

  it("严格虚岁边界：周岁临界年可能差一限", () => {
    // 1990 生，2005 年：周岁 15，虚岁 16
    // 火六首限 6–15，次限 16–25 → 虚岁应入次限
    const r = computeDaxian({
      palaces: mockPalaces("子"),
      mingYinIndex: 10,
      yearStem: "庚",
      gender: "male",
      wuxingJu: "火六局",
      birthYear: 1990,
      baseYear: 2005,
    });
    expect(r.currentDaxianIndex).toBe(1);
  });

  it("同输入 deep equal（固定基准日）", () => {
    const input = {
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male" as const,
      analysisBaseDate: "2026-07-20",
    };
    expect(computeZiweiChart(input)).toEqual(computeZiweiChart(input));
  });
});

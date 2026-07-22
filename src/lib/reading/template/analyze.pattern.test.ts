import { describe, expect, it } from "vitest";
import type { BaziChart } from "@/lib/types";
import { analyzeChart, evaluatePattern } from "./analyze";
import { renderTemplateReading } from "./render";

function baseChart(over: Partial<BaziChart> & {
  pillars: BaziChart["pillars"];
  dayMaster: string;
  tenGods: Record<string, string>;
}): BaziChart {
  return {
    profileId: over.profileId ?? "pattern-test",
    pillars: over.pillars,
    dayMaster: over.dayMaster,
    tenGods: over.tenGods,
    hiddenStems: over.hiddenStems ?? {
      year: over.pillars.year.hiddenStems ?? [],
      month: over.pillars.month.hiddenStems ?? [],
      day: over.pillars.day.hiddenStems ?? [],
      hour: over.pillars.hour?.hiddenStems ?? [],
    },
    wuxingScores: over.wuxingScores ?? {
      wood: 2,
      fire: 2,
      earth: 2,
      metal: 2,
      water: 2,
    },
    relations: over.relations ?? {
      stemHe: [],
      branchChong: [],
      branchLiuhe: [],
      branchSanhe: [],
      branchSanhui: [],
      branchXing: [],
      branchHai: [],
    },
    dayun: over.dayun ?? [],
    currentDayunIndex: over.currentDayunIndex ?? 0,
    liunian: over.liunian ?? [],
    flags: over.flags ?? [],
    meta: over.meta ?? { engineVersion: "0.0.0", skillRef: "bazi-skill" },
  };
}

/**
 * 1. 正官格成格：月令酉藏辛（甲日→正官），辛透月干；印为相神
 * 甲日 · 年乙卯 月辛酉 日甲子 时壬申
 * 月令本气辛透干 → 透干；正官有酉根
 */
const chartZhengGuanCheng: BaziChart = baseChart({
  profileId: "zg-cheng",
  dayMaster: "甲",
  pillars: {
    year: { stem: "乙", branch: "卯", tenGod: "劫财", hiddenStems: ["乙"] },
    month: { stem: "辛", branch: "酉", tenGod: "正官", hiddenStems: ["辛"] },
    day: { stem: "甲", branch: "子", tenGod: "日主", hiddenStems: ["癸"] },
    hour: { stem: "壬", branch: "申", tenGod: "偏印", hiddenStems: ["庚", "壬", "戊"] },
  },
  tenGods: {
    year: "劫财",
    month: "正官",
    day: "日主",
    hour: "偏印",
    乙: "劫财",
    辛: "正官",
    壬: "偏印",
  },
});

/**
 * 2. 伤官见官破象：甲日见丁伤官 + 辛正官
 * 甲日 · 月丁卯（伤官格提纲）年辛（正官）→ 伤官见官
 */
const chartShangGuanJianGuan: BaziChart = baseChart({
  profileId: "sgjg",
  dayMaster: "甲",
  pillars: {
    year: { stem: "辛", branch: "亥", tenGod: "正官", hiddenStems: ["壬", "甲"] },
    month: { stem: "丁", branch: "卯", tenGod: "伤官", hiddenStems: ["乙"] },
    day: { stem: "甲", branch: "辰", tenGod: "日主", hiddenStems: ["戊", "乙", "癸"] },
    hour: { stem: "丙", branch: "寅", tenGod: "食神", hiddenStems: ["甲", "丙", "戊"] },
  },
  tenGods: {
    year: "正官",
    month: "伤官",
    day: "日主",
    hour: "食神",
    辛: "正官",
    丁: "伤官",
    丙: "食神",
  },
});

/**
 * 3. 枭神夺食：甲日见壬偏印 + 丙食神
 * 月令巳藏丙（食神）透丙 → 食神格；年壬枭
 */
const chartXiaoDuoShi: BaziChart = baseChart({
  profileId: "xds",
  dayMaster: "甲",
  pillars: {
    year: { stem: "壬", branch: "子", tenGod: "偏印", hiddenStems: ["癸"] },
    month: { stem: "丙", branch: "巳", tenGod: "食神", hiddenStems: ["丙", "庚", "戊"] },
    day: { stem: "甲", branch: "戌", tenGod: "日主", hiddenStems: ["戊", "辛", "丁"] },
    hour: { stem: "乙", branch: "亥", tenGod: "劫财", hiddenStems: ["壬", "甲"] },
  },
  tenGods: {
    year: "偏印",
    month: "食神",
    day: "日主",
    hour: "劫财",
    壬: "偏印",
    丙: "食神",
    乙: "劫财",
  },
});

/**
 * 4. 月令本气未透：甲日寅月，本气甲未透于其它干（日主甲不算透格用神外干？）
 * 子平：月令本气透出年/月/时干。日主甲与本气甲同字——本气甲出现在日干，
 * allStems includes day stem → 会判透干。改用：甲日辰月本气戊，天干无戊。
 * 甲日 · 年乙 月癸辰 日甲 时壬 → 正财格（辰藏乙为甲之劫？）
 * 甲日辰月：月支藏戊乙癸；月干若癸为偏印，提纲取月干十神偏印。
 * 为测「未透」：月令本气戊，四柱天干无戊。
 * 甲日 · 年乙亥 月癸辰 日甲子 时壬申 — 月干癸偏印 → 偏印格；本气戊未透
 */
const chartWeiTou: BaziChart = baseChart({
  profileId: "weitou",
  dayMaster: "甲",
  pillars: {
    year: { stem: "乙", branch: "亥", tenGod: "劫财", hiddenStems: ["壬", "甲"] },
    month: { stem: "癸", branch: "辰", tenGod: "正印", hiddenStems: ["戊", "乙", "癸"] },
    day: { stem: "甲", branch: "子", tenGod: "日主", hiddenStems: ["癸"] },
    hour: { stem: "壬", branch: "申", tenGod: "偏印", hiddenStems: ["庚", "壬", "戊"] },
  },
  tenGods: {
    year: "劫财",
    month: "正印",
    day: "日主",
    hour: "偏印",
    乙: "劫财",
    癸: "正印",
    壬: "偏印",
  },
  // 时支申藏戊，但本气是否透看天干；天干无戊 → 未透
});

/**
 * 5. 七杀格杀重无制：甲日见庚杀透，无食伤印制化
 * 甲日 · 月庚申 年辛 时乙 — 七杀格，仅官杀比劫，无食伤印
 */
const chartShaWuZhi: BaziChart = baseChart({
  profileId: "swz",
  dayMaster: "甲",
  pillars: {
    year: { stem: "辛", branch: "酉", tenGod: "正官", hiddenStems: ["辛"] },
    month: { stem: "庚", branch: "申", tenGod: "七杀", hiddenStems: ["庚", "壬", "戊"] },
    day: { stem: "甲", branch: "寅", tenGod: "日主", hiddenStems: ["甲", "丙", "戊"] },
    hour: { stem: "乙", branch: "卯", tenGod: "劫财", hiddenStems: ["乙"] },
  },
  tenGods: {
    year: "正官",
    month: "七杀",
    day: "日主",
    hour: "劫财",
    辛: "正官",
    庚: "七杀",
    乙: "劫财",
  },
});

/**
 * 6. 正财格比劫争财：甲日见己正财 + 乙劫财
 */
const chartBiJieZhengCai: BaziChart = baseChart({
  profileId: "bjzc",
  dayMaster: "甲",
  pillars: {
    year: { stem: "乙", branch: "亥", tenGod: "劫财", hiddenStems: ["壬", "甲"] },
    month: { stem: "己", branch: "巳", tenGod: "正财", hiddenStems: ["丙", "庚", "戊"] },
    day: { stem: "甲", branch: "子", tenGod: "日主", hiddenStems: ["癸"] },
    hour: { stem: "丙", branch: "寅", tenGod: "食神", hiddenStems: ["甲", "丙", "戊"] },
  },
  tenGods: {
    year: "劫财",
    month: "正财",
    day: "日主",
    hour: "食神",
    乙: "劫财",
    己: "正财",
    丙: "食神",
  },
});

describe("T90 格局成格/败格 evaluatePattern", () => {
  it("1. 透干且用神有根 → 成格（正官格）", () => {
    const p = evaluatePattern(chartZhengGuanCheng);
    expect(p.patternName).toBe("正官格");
    expect(p.touGan).toBe(true);
    expect(p.monthBenQi).toBe("辛");
    expect(p.yongHasRoot).toBe(true);
    expect(p.patternStatus).toBe("成格");
    expect(p.patternExplain).toMatch(/成格/);
    expect(p.diseases.filter((d) => d.key === "伤官见官")).toHaveLength(0);
  });

  it("2. 伤官见官 → 破象", () => {
    const p = evaluatePattern(chartShangGuanJianGuan);
    expect(p.diseases.some((d) => d.key === "伤官见官")).toBe(true);
    expect(p.patternStatus).toBe("破象");
    expect(p.patternNote).toMatch(/伤官见官/);
    expect(p.patternExplain).toMatch(/伤官见官/);
    const med = p.diseases.find((d) => d.key === "伤官见官");
    expect(med?.medicine).toBeTruthy();
    expect(med?.citation).toMatch(/三命通会/);
  });

  it("3. 枭神夺食 → 有病（可药）", () => {
    const p = evaluatePattern(chartXiaoDuoShi);
    expect(p.patternName).toBe("食神格");
    expect(p.diseases.some((d) => d.key === "枭神夺食")).toBe(true);
    expect(p.patternStatus).toBe("有病");
    expect(p.patternExplain).toMatch(/枭神夺食/);
    expect(p.diseases.find((d) => d.key === "枭神夺食")?.medicine).toMatch(
      /制枭|护食/,
    );
  });

  it("4. 月令本气未透 → 有病/月令未透", () => {
    const p = evaluatePattern(chartWeiTou);
    expect(p.touGan).toBe(false);
    expect(p.monthBenQi).toBe("戊");
    expect(p.diseases.some((d) => d.key === "月令未透")).toBe(true);
    expect(p.patternStatus).toMatch(/有病|待定/);
    expect(p.patternExplain).toMatch(/透干：否/);
  });

  it("5. 七杀无制化 → 破象（杀重无制）", () => {
    const p = evaluatePattern(chartShaWuZhi);
    expect(p.patternName).toBe("七杀格（偏官格）");
    expect(p.diseases.some((d) => d.key === "杀重无制")).toBe(true);
    expect(p.patternStatus).toBe("破象");
    expect(p.patternExplain).toMatch(/杀重无制|破象/);
  });

  it("6. 正财格见比劫 → 比劫争财病象", () => {
    const p = evaluatePattern(chartBiJieZhengCai);
    expect(p.patternName).toBe("正财格");
    expect(p.diseases.some((d) => d.key === "比劫争财")).toBe(true);
    expect(["有病", "破象"]).toContain(p.patternStatus);
  });

  it("analyzeChart 透出格局可解释字段", () => {
    const a = analyzeChart(chartZhengGuanCheng);
    expect(a.touGan).toBe(true);
    expect(a.yongHasRoot).toBe(true);
    expect(a.patternStatus).toBe("成格");
    expect(a.patternExplain).toContain("正官格");
    expect(Array.isArray(a.diseases)).toBe(true);
  });

  it("报告 pattern 章引用成格/病药字段", () => {
    const report = renderTemplateReading(chartShangGuanJianGuan, {
      viewMode: "pro",
    });
    const pattern = report.sections.find((s) => s.key === "pattern");
    expect(pattern).toBeTruthy();
    expect(pattern!.body).toMatch(/破象|伤官见官/);
    expect(pattern!.body).toMatch(/透干|用神有根|病象|药/);
    expect(pattern!.citations?.some((c) => c.includes("子平真诠"))).toBe(true);

    const plain = renderTemplateReading(chartZhengGuanCheng, {
      viewMode: "plain",
    });
    const body = plain.sections.find((s) => s.key === "pattern")!.body;
    expect(body).toMatch(/成格|正官/);
  });
});

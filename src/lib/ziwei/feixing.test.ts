import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "./compute";
import { applyFeixingFlights, feixingMark, mingFeixingSummary } from "./feixing";
import { ENGINE_VERSION } from "./tables/constants";
import { SIHUA_BY_YEAR_STEM } from "./tables/sihua";
import type { ZiweiPalace } from "@/lib/types/ziwei";

describe("飞星飞宫（T190）", () => {
  it("feixingMark 格式", () => {
    expect(feixingMark("命宫", "禄")).toBe("命宫·化禄");
  });

  it("十二宫各飞 4 化 → 至多 48 边；目标星有标记", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:30",
      gender: "male",
      analysisBaseDate: "2024-01-01",
    });
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toMatch(/^0\.\d+\.\d+$/);
    expect(chart.flags).toContain("feixing_palace_flights");
    expect(chart.feixingFlights?.length).toBeGreaterThan(0);
    // 每宫有宫干则 4 出；12×4=48（星均在盘时）
    expect(chart.feixingFlights!.length).toBeLessThanOrEqual(48);
    expect(chart.feixingFlights!.length).toBeGreaterThanOrEqual(40);

    const ming = chart.palaces.find((p) => p.name === "命宫")!;
    expect(ming.feixingOut?.length).toBe(4);
    expect(ming.stem).toBeTruthy();
    const targets = SIHUA_BY_YEAR_STEM[ming.stem as keyof typeof SIHUA_BY_YEAR_STEM];
    for (const kind of ["禄", "权", "科", "忌"] as const) {
      const f = ming.feixingOut!.find((x) => x.kind === kind);
      expect(f?.star).toBe(targets[kind]);
      expect(f?.fromPalace).toBe("命宫");
    }

    // 至少有一颗星带「·化」飞入标记
    const anyFlyIn = chart.palaces.some((p) =>
      p.stars.some((s) => s.sihua?.some((m) => m.includes("·化"))),
    );
    expect(anyFlyIn).toBe(true);
  });

  it("自化：源宫=目标宫时 self=true", () => {
    // 构造：甲干宫内有廉贞 → 化禄自化
    const palaces: ZiweiPalace[] = [
      {
        name: "命宫",
        branch: "寅",
        stem: "甲",
        stars: [{ name: "廉贞", category: "major" }],
      },
      {
        name: "兄弟",
        branch: "丑",
        stem: "乙",
        stars: [
          { name: "破军", category: "major" },
          { name: "武曲", category: "major" },
          { name: "太阳", category: "major" },
        ],
      },
    ];
    const { flights } = applyFeixingFlights(palaces);
    const lu = flights.find(
      (f) => f.fromPalace === "命宫" && f.kind === "禄",
    );
    expect(lu?.self).toBe(true);
    expect(lu?.toPalace).toBe("命宫");
    const lian = palaces[0]!.stars.find((s) => s.name === "廉贞")!;
    expect(lian.sihua).toContain("命宫·化禄");
  });

  it("mingFeixingSummary 非空", () => {
    const chart = computeZiweiChart({
      solarDate: "1988-08-08",
      birthTime: "08:00",
      gender: "female",
      analysisBaseDate: "2024-01-01",
    });
    const s = mingFeixingSummary(chart.feixingFlights ?? []);
    expect(s).toMatch(/命宫化/);
  });
});

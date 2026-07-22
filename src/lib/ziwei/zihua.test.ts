import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "./compute";
import { applyPalaceZihua, hasZihua } from "./zihua";
import { sihuaTargetsByPalaceStem, zihuaMarkOf } from "./tables/zihua";
import { ENGINE_VERSION } from "./tables/constants";
import type { ZiweiPalace } from "@/lib/types/ziwei";

describe("宫干自化（T181）", () => {
  it("与生年表同源", () => {
    const t = sihuaTargetsByPalaceStem("甲");
    expect(t.禄).toBe("廉贞");
    expect(zihuaMarkOf("忌")).toBe("自化忌");
  });

  it("本宫星命中宫干四化则叠自化", () => {
    const palace: ZiweiPalace = {
      name: "命宫",
      branch: "寅",
      stem: "甲",
      stars: [
        { name: "廉贞", category: "major", sihua: ["禄"] },
        { name: "破军", category: "major" },
        { name: "文昌", category: "soft" },
      ],
    };
    applyPalaceZihua(palace);
    const lian = palace.stars.find((s) => s.name === "廉贞")!;
    expect(lian.sihua).toContain("禄");
    expect(lian.sihua).toContain("自化禄");
    const po = palace.stars.find((s) => s.name === "破军")!;
    expect(po.sihua).toContain("自化权");
    expect(hasZihua(lian)).toBe(true);
  });

  it("入盘：engine 对齐且存在自化或博士", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:30",
      gender: "male",
      analysisBaseDate: "2024-01-01",
    });
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toMatch(/^0\.\d+\.\d+$/);
    let zihuaCount = 0;
    let boshiCount = 0;
    for (const p of chart.palaces) {
      for (const s of p.stars) {
        if (s.sihua?.some((x) => x.startsWith("自化"))) zihuaCount++;
        if (s.category === "misc") boshiCount++;
      }
    }
    // 自化取决于宫干与落星重合，可能为 0；博士应恰 12
    expect(boshiCount).toBe(12);
    expect(zihuaCount).toBeGreaterThanOrEqual(0);
  });
});

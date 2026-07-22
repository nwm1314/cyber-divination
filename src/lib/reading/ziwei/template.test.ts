import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/reading/sections";
import {
  createZiweiFixtureChart,
  renderZiweiTemplateReading,
  ZIWEI_SECTION_KEYS,
  ZIWEI_SECTION_TITLES,
} from "@/lib/reading/ziwei";
import {
  extractShareMotto,
  MOTTO_FALLBACK,
} from "@/lib/share/extract-motto";

describe("renderZiweiTemplateReading（T104）", () => {
  it("无 Key / 模板：八章 key 稳定且完整可读", () => {
    const chart = createZiweiFixtureChart();
    const report = renderZiweiTemplateReading(chart, { viewMode: "plain" });

    expect(report.kind).toBe("ziwei");
    expect(report.mode).toBe("template");
    expect(report.chartId).toBe(chart.id);
    expect(report.sections).toHaveLength(8);
    expect(report.sections.map((s) => s.key)).toEqual([...ZIWEI_SECTION_KEYS]);
    expect(report.disclaimer).toBe(DISCLAIMER);

    for (const key of ZIWEI_SECTION_KEYS) {
      const sec = report.sections.find((s) => s.key === key)!;
      expect(sec.title).toBe(ZIWEI_SECTION_TITLES[key]);
      expect(sec.body.trim().length).toBeGreaterThan(10);
    }

    const disclaimerSec = report.sections.find((s) => s.key === "disclaimer")!;
    expect(disclaimerSec.body).toBe(DISCLAIMER);
    expect(disclaimerSec.body).toMatch(/仅供参考|传统文化|不构成/);
  });

  it("含命宫/官禄/财帛等可读摘要，无恐吓断语", () => {
    const report = renderZiweiTemplateReading(createZiweiFixtureChart());
    const text = report.sections.map((s) => s.body).join("\n");
    expect(text).toMatch(/命宫|紫微|天府/);
    expect(text).toMatch(/官禄|财帛|夫妻/);
    expect(text).not.toMatch(/必死|必死无疑|大凶|血光|灾难临头/);
  });

  it("pro 模式可多专业注", () => {
    const plain = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      viewMode: "plain",
    });
    const pro = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      viewMode: "pro",
    });
    expect(pro.viewMode).toBe("pro");
    const proBody = pro.sections.find((s) => s.key === "overview")!.body;
    expect(proBody.length).toBeGreaterThanOrEqual(
      plain.sections.find((s) => s.key === "overview")!.body.length,
    );
    expect(proBody).toMatch(/专业注|流派|引擎/);
  });

  it("gender 影响感情章表述", () => {
    const male = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      gender: "male",
    });
    const female = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      gender: "female",
    });
    const mRel = male.sections.find((s) => s.key === "relationship")!.body;
    const fRel = female.sections.find((s) => s.key === "relationship")!.body;
    expect(mRel).toContain("男命");
    expect(fRel).toContain("女命");
  });

  it("T140：advice 章 body 非空且含实质建议", () => {
    const report = renderZiweiTemplateReading(createZiweiFixtureChart());
    const advice = report.sections.find((s) => s.key === "advice")!;
    expect(advice.body.trim().length).toBeGreaterThan(0);
    expect(advice.body).toMatch(/事业|财务|关系|节奏|建议|命宫|官禄|财帛/);
    const lines = advice.body
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines.some((l) => !/^综合建议/.test(l) && l.length > 8)).toBe(true);
  });

  it("T154：advice 首条非纯标题，融入命宫/官禄/财帛事实，签语可截实质句", () => {
    const report = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      gender: "male",
    });
    const advice = report.sections.find((s) => s.key === "advice")!;
    expect(advice.body.trim().length).toBeGreaterThan(0);
    // 首条即实质句，非「综合建议：」标题
    const firstLine = advice.body.split(/\n/).map((l) => l.trim()).find(Boolean)!;
    expect(firstLine).not.toMatch(/^综合建议/);
    expect(firstLine).toMatch(/命宫|官禄|财帛/);
    // fixture：命宫紫微天府、官禄天相、财帛武曲贪狼
    expect(advice.body).toMatch(/紫微|天府/);
    expect(advice.body).toMatch(/天相|武曲|贪狼/);
    const motto = extractShareMotto(advice.body, {
      fallback: MOTTO_FALLBACK.ziwei,
    });
    expect(motto.trim().length).toBeGreaterThan(0);
    expect(motto).not.toMatch(/^综合建议/);
    expect(motto).not.toBe(MOTTO_FALLBACK.ziwei);
    expect(motto).toMatch(/命宫|官禄|财帛|紫微|天府|天相|武曲/);
  });

  it("T162：命宫/advice 引用辅星事实（fixture 含左辅右弼）", () => {
    const report = renderZiweiTemplateReading(createZiweiFixtureChart(), {
      gender: "male",
    });
    const ming = report.sections.find((s) => s.key === "ming_gong")!.body;
    const advice = report.sections.find((s) => s.key === "advice")!.body;
    expect(ming).toMatch(/左辅|右弼|吉辅/);
    expect(advice).toMatch(/左辅|右弼|吉辅|命宫另见/);
    expect(advice).not.toMatch(/必死|大凶|血光/);
  });

  it("T172：真实排盘命宫主星可带庙旺亮度", async () => {
    const { computeZiweiChart } = await import("@/lib/ziwei");
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    const report = renderZiweiTemplateReading(chart, { gender: "male" });
    const ming = report.sections.find((s) => s.key === "ming_gong")!.body;
    expect(ming).toMatch(/庙|旺|得|利|平|陷/);
    expect(ming).toMatch(/庙旺利陷|得地|不作吉凶/);
    expect(ming).not.toMatch(/必死|大凶|血光/);
  });

  it("T184：真实排盘命宫可引用博士系或四化/自化", async () => {
    const { computeZiweiChart } = await import("@/lib/ziwei");
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    const report = renderZiweiTemplateReading(chart, { gender: "male" });
    const ming = report.sections.find((s) => s.key === "ming_gong")!.body;
    const advice = report.sections.find((s) => s.key === "advice")!.body;
    // 博士十二神或四化/自化至少一类出现在命宫/advice 事实链
    expect(ming + advice).toMatch(
      /博士|力士|青龙|杂曜|四化|自化|禄|权|科|忌|吉辅|煞曜/,
    );
    expect(ming + advice).not.toMatch(/必死|大凶|血光/);
  });

  it("T193：命宫引用飞出或流昌/截空事实", async () => {
    const { computeZiweiChart } = await import("@/lib/ziwei");
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    expect(chart.feixingFlights?.length).toBeGreaterThan(0);
    const report = renderZiweiTemplateReading(chart, { gender: "male" });
    const ming = report.sections.find((s) => s.key === "ming_gong")!.body;
    expect(ming).toMatch(/飞出|化禄|化权|化科|化忌|流昌|流曲|截空|·化/);
    expect(ming).not.toMatch(/必死|大凶|血光/);
  });

  it("T202：大限流年章可引用运限四化或流昌", async () => {
    const { computeZiweiChart } = await import("@/lib/ziwei");
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    const report = renderZiweiTemplateReading(chart, { gender: "male" });
    const luck = report.sections.find((s) => s.key === "luck")!.body;
    expect(luck).toMatch(/大限|流年|化禄|化权|化科|化忌|流昌|流曲|飞出/);
    expect(luck).not.toMatch(/必死|大凶|血光/);
  });

  it("T240：luck 章含流月/流日摘要", async () => {
    const { computeZiweiChart } = await import("@/lib/ziwei");
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-07-15",
    });
    const report = renderZiweiTemplateReading(chart, {
      gender: "male",
      viewMode: "plain",
    });
    const luck = report.sections.find((s) => s.key === "luck")!.body;
    expect(luck).toMatch(/流月|当月/);
    expect(luck).toMatch(/流日|当日/);
    expect(luck.length).toBeGreaterThan(40);
  });
});

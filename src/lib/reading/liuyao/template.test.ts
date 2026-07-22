import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/reading/sections";
import { castLiuyao } from "@/lib/liuyao/cast";
import {
  createLiuyaoFixtureChart,
  renderLiuyaoTemplateReading,
  LIUYAO_SECTION_KEYS,
  LIUYAO_SECTION_TITLES,
} from "@/lib/reading/liuyao";
import {
  extractShareMotto,
  MOTTO_FALLBACK,
} from "@/lib/share/extract-motto";

describe("renderLiuyaoTemplateReading（T114）", () => {
  it("无 Key / 模板：七章 key 稳定且完整可读", () => {
    const chart = createLiuyaoFixtureChart();
    const report = renderLiuyaoTemplateReading(chart, { viewMode: "plain" });

    expect(report.kind).toBe("liuyao");
    expect(report.mode).toBe("template");
    expect(report.chartId).toBe(chart.id);
    expect(report.question).toBe(chart.question);
    expect(report.sections).toHaveLength(7);
    expect(report.sections.map((s) => s.key)).toEqual([...LIUYAO_SECTION_KEYS]);
    expect(report.disclaimer).toBe(DISCLAIMER);

    for (const key of LIUYAO_SECTION_KEYS) {
      const sec = report.sections.find((s) => s.key === key)!;
      expect(sec.title).toBe(LIUYAO_SECTION_TITLES[key]);
      expect(sec.body.trim().length).toBeGreaterThan(10);
    }

    const disclaimerSec = report.sections.find((s) => s.key === "disclaimer")!;
    expect(disclaimerSec.body).toBe(DISCLAIMER);
    expect(disclaimerSec.body).toMatch(/仅供参考|传统文化|不构成/);
  });

  it("强调一事一问，含本卦/动变，无恐吓断语", () => {
    const report = renderLiuyaoTemplateReading(createLiuyaoFixtureChart());
    const text = report.sections.map((s) => s.body).join("\n");
    expect(text).toMatch(/一事一问/);
    expect(text).toMatch(/乾为天|本卦/);
    expect(text).toMatch(/动|变卦/);
    expect(text).not.toMatch(/必死|必死无疑|大凶|血光|灾难临头/);
  });

  it("静卦（无动爻）仍可读", () => {
    const chart = castLiuyao({
      question: "静卦测试",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "ly_static",
    });
    expect(chart.bianGua).toBeUndefined();
    const report = renderLiuyaoTemplateReading(chart);
    const changing = report.sections.find((s) => s.key === "changing")!.body;
    expect(changing).toMatch(/无动爻|静卦/);
    expect(report.sections).toHaveLength(7);
  });

  it("pro 模式可多专业注", () => {
    const plain = renderLiuyaoTemplateReading(createLiuyaoFixtureChart(), {
      viewMode: "plain",
    });
    const pro = renderLiuyaoTemplateReading(createLiuyaoFixtureChart(), {
      viewMode: "pro",
    });
    expect(pro.viewMode).toBe("pro");
    const proBody = pro.sections.find((s) => s.key === "ben_gua")!.body;
    expect(proBody.length).toBeGreaterThanOrEqual(
      plain.sections.find((s) => s.key === "ben_gua")!.body.length,
    );
    expect(proBody).toMatch(/专业注|引擎/);
  });

  it("T140：advice 章 body 非空且含可执行建议", () => {
    const report = renderLiuyaoTemplateReading(createLiuyaoFixtureChart());
    const advice = report.sections.find((s) => s.key === "advice")!;
    expect(advice.body.trim().length).toBeGreaterThan(0);
    expect(advice.body).toMatch(/一事一问|节奏|建议|现实|本卦/);
    const lines = advice.body
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines.some((l) => !/^行动建议/.test(l) && l.length > 8)).toBe(true);
  });

  it("question 章含所问原文", () => {
    const chart = createLiuyaoFixtureChart({
      question: "这次合作是否适合推进？",
    });
    const report = renderLiuyaoTemplateReading(chart);
    const q = report.sections.find((s) => s.key === "question")!.body;
    expect(q).toContain("这次合作是否适合推进？");
    expect(q).toMatch(/一事一问/);
  });

  it("T154：advice/judgment 引用本卦名、动爻、用神，签语非纯标题", () => {
    const report = renderLiuyaoTemplateReading(createLiuyaoFixtureChart());
    const advice = report.sections.find((s) => s.key === "advice")!;
    const judgment = report.sections.find((s) => s.key === "judgment")!;
    expect(advice.body.trim().length).toBeGreaterThan(0);
    expect(judgment.body.trim().length).toBeGreaterThan(0);

    // fixture：乾为天，初爻动；含一事一问 + 本卦/动爻/用神
    for (const body of [advice.body, judgment.body]) {
      expect(body).toMatch(/乾为天|本卦/);
      expect(body).toMatch(/初爻|动|无动爻/);
      expect(body).toMatch(/用神|一事一问|所问/);
      const first = body.split(/\n/).map((l) => l.trim()).find(Boolean)!;
      expect(first).not.toMatch(/^(行动建议|综合建议|判断)/);
    }

    const motto = extractShareMotto(advice.body, {
      fallback: MOTTO_FALLBACK.liuyao,
    });
    expect(motto.trim().length).toBeGreaterThan(0);
    expect(motto).not.toMatch(/^行动建议/);
    expect(motto).not.toBe(MOTTO_FALLBACK.liuyao);
    expect(motto).toMatch(/本卦|乾|一事一问|用神|动|初爻|工作/);
  });

  it("T154：静卦 advice 仍引用本卦且签语实质非空", () => {
    const chart = castLiuyao({
      question: "是否适合按原计划推进？",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "ly_static_t154",
    });
    const report = renderLiuyaoTemplateReading(chart);
    const advice = report.sections.find((s) => s.key === "advice")!;
    expect(advice.body).toMatch(/无动爻|静卦/);
    expect(advice.body).toMatch(/本卦/);
    expect(advice.body).toMatch(/一事一问|所问/);
    const motto = extractShareMotto(advice.body, {
      fallback: MOTTO_FALLBACK.liuyao,
    });
    expect(motto).not.toMatch(/^行动建议/);
    expect(motto.trim().length).toBeGreaterThan(6);
  });

  it("T162：动卦 changing 章含动变生克表驱动摘要", () => {
    const chart = castLiuyao({
      question: "这次合作是否适合推进？",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
      id: "ly_t162_dong",
    });
    const report = renderLiuyaoTemplateReading(chart);
    const changing = report.sections.find((s) => s.key === "changing")!.body;
    expect(changing).toMatch(/动变生克|动生化|动克化|化生动|化克动|比和/);
    expect(changing).not.toMatch(/必死|大凶|血光/);
    const advice = report.sections.find((s) => s.key === "advice")!.body;
    expect(advice).toMatch(/动变生克|弹性|分步/);
  });

  it("T172：advice/世应引用用神状态（静|动|化）", () => {
    const chart = castLiuyao({
      question: "求财是否顺利",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "ly_t172_st",
    });
    const report = renderLiuyaoTemplateReading(chart);
    const advice = report.sections.find((s) => s.key === "advice")!.body;
    const shi = report.sections.find((s) => s.key === "shi_ying")!.body;
    expect(advice).toMatch(/静|动|化/);
    expect(shi).toMatch(/静|动|化|用神/);
    expect(advice + shi).not.toMatch(/必死|大凶|血光/);
  });

  it("T184：有占时则世应/advice 引用日辰或旬空/应期", () => {
    const chart = castLiuyao({
      question: "求财是否顺利",
      method: "manual",
      lines: [7, 8, 7, 8, 7, 8],
      castAt: "2024-06-15T10:00",
      id: "ly_t184_yingqi",
    });
    expect(chart.dayGanZhi).toBeTruthy();
    const report = renderLiuyaoTemplateReading(chart);
    const advice = report.sections.find((s) => s.key === "advice")!.body;
    const shi = report.sections.find((s) => s.key === "shi_ying")!.body;
    expect(advice + shi).toMatch(/日辰|旬空|应期|月建/);
    expect(advice + shi).not.toMatch(/必死|大凶|血光/);
  });
});

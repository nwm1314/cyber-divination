import { describe, expect, it } from "vitest";
import {
  extractShareMotto,
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
} from "./extract-motto";

describe("extractShareMotto（T140）", () => {
  it("跳过「综合建议：」标题行，取实质句", () => {
    const body = [
      "综合建议（男命，供参考）：",
      "1. 事业：官禄主星为紫微，宜选能发挥优势的方向。",
      "2. 财务：理财以可承受风险为先。",
    ].join("\n");
    const motto = extractShareMotto(body);
    expect(motto.trim().length).toBeGreaterThan(0);
    expect(motto).not.toMatch(/^综合建议/);
    expect(motto).toMatch(/事业|官禄|紫微|发挥/);
  });

  it("跳过「行动建议」标题", () => {
    const body = [
      "行动建议（中性、可执行，仅供参考）：",
      "1. 一事一问：本卦只回答当前所问。",
      "2. 节奏：有动变，宜预留弹性。",
    ].join("\n");
    const motto = extractShareMotto(body, {
      fallback: MOTTO_FALLBACK.liuyao,
    });
    expect(motto).not.toMatch(/^行动建议/);
    expect(motto).toMatch(/一事一问|本卦|动变|弹性/);
  });

  it("空 body 使用兜底", () => {
    expect(extractShareMotto("")).toBe(MOTTO_FALLBACK.bazi);
    expect(extractShareMotto(null)).toBe(MOTTO_FALLBACK.bazi);
    expect(
      extractShareMotto("", { fallback: MOTTO_FALLBACK.liuyao }),
    ).toBe(MOTTO_FALLBACK.liuyao);
  });

  it("仅有标题行时仍非空（兜底）", () => {
    const motto = extractShareMotto("综合建议：\n");
    expect(motto.trim().length).toBeGreaterThan(0);
    expect(motto).toBe(MOTTO_FALLBACK.bazi);
  });

  it("超长截断并加省略号", () => {
    const long =
      "这是一句很长很长的建议内容用于测试截断逻辑是否正常工作并且不会空白";
    const motto = extractShareMotto(long, { maxLen: 20 });
    expect(motto.endsWith("…")).toBe(true);
    expect(motto.length).toBeLessThanOrEqual(21);
  });

  it("fromSections 优先 advice，六爻可回落 judgment", () => {
    const motto = extractShareMottoFromSections(
      [
        { key: "overview", body: "总览占位很长很长很长" },
        {
          key: "advice",
          body: "综合建议：\n宜稳中求进，厚积薄发，勿急于求成。",
        },
      ],
      { preferKeys: ["advice"] },
    );
    expect(motto).toMatch(/稳中求进|厚积薄发/);

    const ly = extractShareMottoFromSections(
      [
        {
          key: "judgment",
          body: "判断：本卦提示先稳后进，宜分步验证。",
        },
      ],
      {
        preferKeys: ["advice", "judgment"],
        fallback: MOTTO_FALLBACK.liuyao,
      },
    );
    expect(ly).toMatch(/先稳后进|分步验证/);
  });
});

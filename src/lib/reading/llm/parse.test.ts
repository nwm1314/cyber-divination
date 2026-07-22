import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  parseLlmReadingContent,
  parseSectionsFromText,
} from "./parse";
import { findSafetyViolation } from "./safety";
import { SECTION_KEYS, SECTION_TITLES } from "../sections";

function fullTextSections(): string {
  return SECTION_KEYS.map(
    (k, i) => `${i + 1}. ${SECTION_TITLES[k]}\n本章说明要点，语气中性建设。`,
  ).join("\n");
}

function fullJson(): string {
  return JSON.stringify({
    sections: SECTION_KEYS.map((key) => ({
      key,
      body: `结构化正文：${key}，据《滴天髓》风格。`,
      styleCitations: ["滴天髓"],
    })),
  });
}

describe("parseLlmReadingContent T290", () => {
  it("优先解析合法 JSON", () => {
    const r = parseLlmReadingContent(fullJson(), SECTION_KEYS, SECTION_TITLES);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("json");
      expect(r.sections).toHaveLength(8);
      expect(r.sections[0]!.key).toBe("day_master");
    }
  });

  it("坏 JSON 回落文本分段", () => {
    const r = parseLlmReadingContent(
      "not json\n" + fullTextSections(),
      SECTION_KEYS,
      SECTION_TITLES,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("text");
  });

  it("缺章拦截", () => {
    const partial = JSON.stringify({
      sections: [
        { key: "day_master", body: "仅有一章" },
        { key: "ten_gods", body: "二章" },
      ],
    });
    const r = parseLlmReadingContent(partial, SECTION_KEYS, SECTION_TITLES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/缺少|空章节/);
  });

  it("绝对断言拦截", () => {
    const bad = fullJson().replace(
      "结构化正文：day_master",
      "此人必定会破产且必死无疑",
    );
    const r = parseLlmReadingContent(bad, SECTION_KEYS, SECTION_TITLES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/绝对断言|回落/);
  });

  it("虚构精确引用拦截", () => {
    const bad = fullJson().replace(
      "据《滴天髓》风格",
      "见《滴天髓》第999页",
    );
    const r = parseLlmReadingContent(bad, SECTION_KEYS, SECTION_TITLES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/引用|回落/);
  });

  it("extractJsonObject 支持 fence", () => {
    const raw = "```json\n" + fullJson() + "\n```";
    const obj = extractJsonObject(raw) as { sections: unknown[] };
    expect(obj.sections).toHaveLength(8);
  });

  it("parseSectionsFromText 可按标题切分", () => {
    const secs = parseSectionsFromText(
      fullTextSections(),
      SECTION_KEYS,
      SECTION_TITLES,
    );
    expect(secs.length).toBeGreaterThanOrEqual(6);
  });
});

describe("findSafetyViolation", () => {
  it("放行中性叙述", () => {
    expect(findSafetyViolation("宜结合现实努力，仅供参考。")).toBeNull();
  });

  it("拦截稳赚不赔", () => {
    const v = findSafetyViolation("此运稳赚不赔");
    expect(v?.kind).toBe("absolute_assertion");
  });
});
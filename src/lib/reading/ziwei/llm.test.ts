import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createZiweiFixtureChart,
  llmZiweiReading,
  ZIWEI_SECTION_KEYS,
} from "@/lib/reading/ziwei";

describe("llmZiweiReading（T104）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("无 API Key 时回落模板且完整可读", async () => {
    const originalKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    const chart = createZiweiFixtureChart();
    const report = await llmZiweiReading(chart);

    expect(report.fallback).toBe(true);
    expect(report.mode).toBe("llm");
    expect(report.kind).toBe("ziwei");
    expect(report.fallbackReason).toMatch(/LLM_API_KEY|未配置/);
    expect(report.sections).toHaveLength(8);
    expect(report.sections.map((s) => s.key)).toEqual([...ZIWEI_SECTION_KEYS]);
    expect(report.disclaimer).toMatch(/仅供参考|传统文化/);
    for (const s of report.sections) {
      expect(s.body.trim().length).toBeGreaterThan(5);
    }

    process.env.LLM_API_KEY = originalKey;
  });

  it("API 失败时回落模板", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://invalid-url.local";
    process.env.LLM_MODEL = "test-model";

    const report = await llmZiweiReading(createZiweiFixtureChart());
    expect(report.fallback).toBe(true);
    expect(report.mode).toBe("llm");
    expect(report.sections).toHaveLength(8);
    expect(report.fallbackReason).toBeTruthy();
  });

  it("成功时解析八章并强制免责", async () => {
    process.env.LLM_API_KEY = "test-key-ok";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_MODEL = "test-model";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                "1. 命盘总览\n总览甲。",
                "2. 命宫解读\n命宫乙。",
                "3. 事业宫（官禄）\n事业丙。",
                "4. 财帛宫\n财帛丁。",
                "5. 感情宫（夫妻）\n感情戊。",
                "6. 大限与运限\n大限己。",
                "7. 综合建议\n建议庚。",
                "8. 免责声明\n模型乱写免责。",
              ].join("\n"),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmZiweiReading(createZiweiFixtureChart(), {
      viewMode: "plain",
      gender: "female",
    });

    expect(report.fallback).toBe(false);
    expect(report.sections.map((s) => s.key)).toEqual([...ZIWEI_SECTION_KEYS]);
    expect(report.sections.find((s) => s.key === "overview")!.body).toMatch(
      /总览甲/,
    );
    expect(report.sections.find((s) => s.key === "disclaimer")!.body).toMatch(
      /仅供参考|传统文化|不构成/,
    );
    expect(report.disclaimer).toMatch(/仅供参考|传统文化/);

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });
});

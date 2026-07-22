import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createLiuyaoFixtureChart,
  llmLiuyaoReading,
  LIUYAO_SECTION_KEYS,
} from "@/lib/reading/liuyao";

describe("llmLiuyaoReading（T114）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("无 API Key 时回落模板且完整可读", async () => {
    const originalKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    const chart = createLiuyaoFixtureChart();
    const report = await llmLiuyaoReading(chart);

    expect(report.fallback).toBe(true);
    expect(report.mode).toBe("llm");
    expect(report.kind).toBe("liuyao");
    expect(report.fallbackReason).toMatch(/LLM_API_KEY|未配置/);
    expect(report.sections).toHaveLength(7);
    expect(report.sections.map((s) => s.key)).toEqual([...LIUYAO_SECTION_KEYS]);
    expect(report.disclaimer).toMatch(/仅供参考|传统文化/);
    expect(report.question).toBe(chart.question);
    for (const s of report.sections) {
      expect(s.body.trim().length).toBeGreaterThan(5);
    }

    process.env.LLM_API_KEY = originalKey;
  });

  it("API 失败时回落模板", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://invalid-url.local";
    process.env.LLM_MODEL = "test-model";

    const report = await llmLiuyaoReading(createLiuyaoFixtureChart());
    expect(report.fallback).toBe(true);
    expect(report.mode).toBe("llm");
    expect(report.sections).toHaveLength(7);
    expect(report.fallbackReason).toBeTruthy();
  });

  it("成功时解析七章并强制免责", async () => {
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
                "1. 所问事项\n问事甲。",
                "2. 本卦概览\n本卦乙。",
                "3. 动爻与变卦\n动变丙。",
                "4. 世应要点\n世应丁。",
                "5. 易理判断\n判断戊。",
                "6. 行动建议\n建议己。",
                "7. 免责声明\n模型乱写免责。",
              ].join("\n"),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmLiuyaoReading(createLiuyaoFixtureChart(), {
      viewMode: "plain",
    });

    expect(report.fallback).toBe(false);
    expect(report.sections.map((s) => s.key)).toEqual([...LIUYAO_SECTION_KEYS]);
    expect(report.sections.find((s) => s.key === "question")!.body).toMatch(
      /问事甲/,
    );
    expect(report.sections.find((s) => s.key === "disclaimer")!.body).toMatch(
      /仅供参考|传统文化|不构成/,
    );
    expect(report.disclaimer).toMatch(/仅供参考|传统文化/);

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });
});

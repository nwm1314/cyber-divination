import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BaziChart } from "@/lib/types";
import { llmReading } from "./llm";

const mockChart: BaziChart = {
  profileId: "mock-llm-1",
  pillars: {
    year: { stem: "甲", branch: "子", tenGod: "正印", hiddenStems: ["癸"] },
    month: { stem: "丙", branch: "寅", tenGod: "食神", hiddenStems: ["甲", "丙", "戊"] },
    day: { stem: "戊", branch: "午", tenGod: "日主", hiddenStems: ["丁", "己"] },
    hour: { stem: "丁", branch: "巳", tenGod: "正印", hiddenStems: ["丙", "庚", "戊"] },
  },
  dayMaster: "戊",
  tenGods: {
    year: "正印",
    month: "食神",
    day: "日主",
    hour: "正印",
  },
  hiddenStems: {
    year: ["癸"],
    month: ["甲", "丙", "戊"],
    day: ["丁", "己"],
    hour: ["丙", "庚", "戊"],
  },
  wuxingScores: { wood: 2, fire: 4, earth: 3, metal: 1, water: 1 },
  relations: {
    stemHe: [],
    branchChong: [],
    branchLiuhe: [],
    branchSanhe: [],
    branchSanhui: [],
    branchXing: [],
    branchHai: [],
  },
  dayun: [
    { index: 0, stem: "丁", branch: "丑", startAge: 3, endAge: 12, startYear: 1993, endYear: 2002 },
    { index: 1, stem: "戊", branch: "寅", startAge: 13, endAge: 22, startYear: 2003, endYear: 2012 },
    { index: 2, stem: "己", branch: "卯", startAge: 23, endAge: 32, startYear: 2013, endYear: 2022 },
    { index: 3, stem: "庚", branch: "辰", startAge: 33, endAge: 42, startYear: 2023, endYear: 2032 },
  ],
  currentDayunIndex: 3,
  liunian: [
    { year: 2024, stem: "甲", branch: "辰", age: 34 },
    { year: 2025, stem: "乙", branch: "巳", age: 35 },
    { year: 2026, stem: "丙", branch: "午", age: 36 },
  ],
  flags: [],
  meta: { engineVersion: "0.0.0", skillRef: "bazi-skill" },
};

describe("llmReading", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("无 API Key 时自动回落到模板模式", async () => {
    const originalKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    const report = await llmReading(mockChart);

    expect(report.fallback).toBe(true);
    // 用户选了 LLM：mode 保持 llm，fallback 标记回落模板正文
    expect(report.mode).toBe("llm");
    expect(report.fallbackReason).toMatch(/LLM_API_KEY|未配置/);
    expect(report.sections).toHaveLength(8);
    expect(report.chartId).toBe("mock-llm-1");
    expect(report.disclaimer).toContain("仅供参考");

    process.env.LLM_API_KEY = originalKey;
  });

  it("API 调用失败时自动回落到模板模式", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://invalid-url.local";
    process.env.LLM_MODEL = "test-model";

    const report = await llmReading(mockChart);

    expect(report.fallback).toBe(true);
    expect(report.mode).toBe("llm");
    expect(report.fallbackReason).toBeTruthy();
    expect(report.sections).toHaveLength(8);
  });

  it("返回结构符合 ReadingReport 类型", async () => {
    const originalKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    const report = await llmReading(mockChart, "pro");

    expect(report).toHaveProperty("chartId");
    expect(report).toHaveProperty("mode");
    expect(report).toHaveProperty("viewMode", "pro");
    expect(report).toHaveProperty("sections");
    expect(report).toHaveProperty("calibratePrompts");
    expect(report).toHaveProperty("disclaimer");
    expect(report).toHaveProperty("fallback", true);

    for (const s of report.sections) {
      expect(s).toHaveProperty("key");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("body");
    }

    process.env.LLM_API_KEY = originalKey;
  });

  it("T93：回落模板时透传 gender，男/女命六亲可区分", async () => {
    const originalKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;

    const male = await llmReading(mockChart, {
      viewMode: "plain",
      gender: "male",
    });
    const female = await llmReading(mockChart, {
      viewMode: "plain",
      gender: "female",
    });

    expect(male.fallback).toBe(true);
    expect(female.fallback).toBe(true);

    const mTen = male.sections.find((s) => s.key === "ten_gods")!.body;
    const fTen = female.sections.find((s) => s.key === "ten_gods")!.body;
    const mAdv = male.sections.find((s) => s.key === "advice")!.body;
    const fAdv = female.sections.find((s) => s.key === "advice")!.body;

    expect(mTen).toContain("男命");
    expect(fTen).toContain("女命");
    expect(mTen).not.toBe(fTen);
    expect(mAdv).not.toBe(fAdv);

    process.env.LLM_API_KEY = originalKey;
  });

  it("T93：system prompt 构建含性别（mock fetch 捕获）", async () => {
    process.env.LLM_API_KEY = "test-key-gender";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_MODEL = "test-model";

    let capturedSystem = "";
    let capturedUser = "";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages: { role: string; content: string }[];
      };
      capturedSystem = body.messages.find((m) => m.role === "system")?.content ?? "";
      capturedUser = body.messages.find((m) => m.role === "user")?.content ?? "";
      return {
        ok: true,
        json: async () => ({
          model: "test-model",
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
          choices: [
            {
              message: {
                content: [
                  "1. 日主强弱与性格倾向\n甲。",
                  "2. 十神与六亲要点\n乙。",
                  "3. 五行平衡与喜用\n丙。",
                  "4. 格局判定\n丁。",
                  "5. 大运分析\n戊。",
                  "6. 流年分析\n己。",
                  "7. 历史事件校准\n庚。",
                  "8. 综合建议\n辛。",
                ].join("\n"),
              },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmReading(mockChart, {
      viewMode: "plain",
      gender: "female",
      requestId: "req-test-gender",
    });

    expect(report.fallback).toBe(false);
    expect(report.meta?.usage.totalTokens).toBe(150);
    expect(report.meta?.model).toBe("test-model");
    expect(capturedSystem).toMatch(/女命|性别/);
    expect(capturedSystem).toMatch(/正官|夫星|伴侣/);
    expect(capturedUser).toMatch(/女命|性别/);

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("T290：坏 JSON / 缺章时回落模板", async () => {
    process.env.LLM_API_KEY = "test-key-parse";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_MODEL = "test-model";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: "test-model",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        choices: [{ message: { content: '{"sections":[{"key":"day_master","body":"only"}]}' } }],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmReading(mockChart, { viewMode: "plain", requestId: "req-bad-json" });
    expect(report.fallback).toBe(true);
    expect(report.fallbackReason).toMatch(/缺少|空章节|结构化/);
    expect(report.sections).toHaveLength(8);
    expect(report.engineVersion).toBe("0.0.0");

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("T290：绝对断言拦截并回落", async () => {
    process.env.LLM_API_KEY = "test-key-abs";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_MODEL = "test-model";

    const body = {
      sections: [
        "day_master","ten_gods","wuxing","pattern","dayun","liunian","calibrate","advice",
      ].map((key) => ({
        key,
        body: key === "advice" ? "此人必定会发财" : `正文${key}`,
      })),
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: "test-model",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        choices: [{ message: { content: JSON.stringify(body) } }],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmReading(mockChart, { viewMode: "plain", requestId: "req-abs" });
    expect(report.fallback).toBe(true);
    expect(report.fallbackReason).toMatch(/绝对断言/);

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("T290：合法 JSON 成功且透传 evidence", async () => {
    process.env.LLM_API_KEY = "test-key-ok";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_MODEL = "test-model";

    const chart = {
      ...mockChart,
      evidence: [
        {
          ruleId: "yongshen.fuyi.v1",
          source: "engine",
          conclusion: "扶抑用木",
          confidence: 0.8,
        },
      ],
      warnings: ["测试警告"],
    };

    const body = {
      sections: [
        "day_master","ten_gods","wuxing","pattern","dayun","liunian","calibrate","advice",
      ].map((key) => ({ key, body: `结构化${key}（据《滴天髓》风格）` })),
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: "test-model",
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        choices: [{ message: { content: "```json\n" + JSON.stringify(body) + "\n```" } }],
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const report = await llmReading(chart, { viewMode: "pro", requestId: "req-ok-json" });
    expect(report.fallback).toBe(false);
    expect(report.meta?.parseSource).toBe("json");
    expect(report.evidence?.[0]?.ruleId).toBe("yongshen.fuyi.v1");
    expect(report.warnings).toContain("测试警告");
    expect(report.sections[0]!.body).toContain("结构化");

    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });
});

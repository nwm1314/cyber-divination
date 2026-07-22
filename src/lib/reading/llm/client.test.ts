import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, llmErrorCode } from "./client";
import { logApi } from "@/lib/api/logger";

describe("llm client（T211）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("成功时解析 usage 并打 llm.chat.ok", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "gpt-test";
    process.env.LLM_BASE_URL = "https://example.test";

    const lines: string[] = [];
    const orig = console.info;
    console.info = (msg?: unknown) => {
      lines.push(String(msg));
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: "gpt-test",
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
          choices: [{ message: { content: "hello" } }],
        }),
      })),
    );

    try {
      const r = await chatCompletion(
        [{ role: "user", content: "hi" }],
        { art: "bazi", requestId: "r-ok" },
      );
      expect(r.content).toBe("hello");
      expect(r.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
      const okLine = lines.find((l) => l.includes("llm.chat.ok"));
      expect(okLine).toBeTruthy();
      const payload = JSON.parse(okLine!);
      expect(payload.art).toBe("bazi");
      expect(payload.model).toBe("gpt-test");
      expect(payload.promptTokens).toBe(10);
      expect(payload.totalTokens).toBe(30);
      expect(payload.fallback).toBe(false);
      expect(payload.requestId).toBe("r-ok");
    } finally {
      console.info = orig;
      delete process.env.LLM_API_KEY;
    }
  });

  it("HTTP 失败打 errorCode 且不落密钥", async () => {
    process.env.LLM_API_KEY = "sk-secret-should-not-appear";
    process.env.LLM_BASE_URL = "https://example.test";

    const lines: string[] = [];
    const origErr = console.error;
    console.error = (msg?: unknown) => {
      lines.push(String(msg));
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => "rate",
      })),
    );

    try {
      await expect(
        chatCompletion([{ role: "user", content: "x" }], {
          art: "ziwei",
          requestId: "r-fail",
        }),
      ).rejects.toThrow(/LLM_HTTP_429/);
      const errLine = lines.find((l) => l.includes("llm.chat.error"));
      expect(errLine).toBeTruthy();
      expect(errLine).not.toContain("sk-secret-should-not-appear");
      const payload = JSON.parse(errLine!);
      expect(payload.errorCode).toBe("LLM_HTTP_429");
      expect(payload.art).toBe("ziwei");
    } finally {
      console.error = origErr;
      delete process.env.LLM_API_KEY;
    }
  });

  it("llmErrorCode 映射", () => {
    expect(llmErrorCode(new Error("LLM_API_KEY not configured"))).toBe(
      "LLM_NOT_CONFIGURED",
    );
    expect(llmErrorCode(new Error("LLM_HTTP_500"))).toBe("LLM_HTTP_500");
    expect(llmErrorCode(new Error("LLM_EMPTY"))).toBe("LLM_EMPTY");
  });

  it("logApi scrub 仍生效", () => {
    const lines: string[] = [];
    const orig = console.info;
    console.info = (msg?: unknown) => {
      lines.push(String(msg));
    };
    try {
      logApi("info", "test.scrub", {
        requestId: "r1",
        route: "/api/reading",
        art: "bazi",
        model: "m",
        promptTokens: 1,
        completionTokens: null,
        totalTokens: null,
        apiKey: "sk-secret-should-not-appear",
      });
      const line = lines[0] ?? "";
      expect(line).toContain("[redacted]");
      expect(line).not.toContain("sk-secret-should-not-appear");
      expect(line).toContain("promptTokens");
    } finally {
      console.info = orig;
    }
  });
});

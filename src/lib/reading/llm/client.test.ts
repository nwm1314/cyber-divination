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
    expect(llmErrorCode(new Error("LLM_TIMEOUT"))).toBe("LLM_TIMEOUT");
  });

  /**
   * P0 回归：LLM 请求必须有超时。
   *
   * 原缺陷：`chatCompletion` 直接 `await fetch(...)`，无 signal/超时，
   * 上游挂起时请求永久占用连接与函数实例。攻击/故障场景：把
   * LLM_BASE_URL 指向黑洞端口，请求永不返回。
   */
  it("上游挂起时按超时中断并归类为 LLM_TIMEOUT", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://blackhole.test";
    process.env.LLM_TIMEOUT_MS = "50";

    const lines: string[] = [];
    const origErr = console.error;
    console.error = (msg?: unknown) => {
      lines.push(String(msg));
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            // 模拟上游永不响应：仅在 abort 时拒绝
            const signal = init?.signal;
            if (!signal) {
              // 若实现未传 signal，则永不 settle，测试将超时失败
              return;
            }
            if (signal.aborted) {
              const e = new Error("The operation was aborted");
              e.name = "TimeoutError";
              reject(e);
              return;
            }
            signal.addEventListener("abort", () => {
              const e = new Error("The operation was aborted");
              e.name = "TimeoutError";
              reject(e);
            });
          }),
      ),
    );

    try {
      await expect(
        chatCompletion([{ role: "user", content: "x" }], {
          art: "bazi",
          requestId: "r-timeout",
        }),
      ).rejects.toThrow(/LLM_TIMEOUT/);

      const errLine = lines.find((l) => l.includes("llm.chat.error"));
      expect(errLine).toBeTruthy();
      const payload = JSON.parse(errLine!);
      expect(payload.errorCode).toBe("LLM_TIMEOUT");
      expect(payload.fallback).toBe(true);
    } finally {
      console.error = origErr;
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_TIMEOUT_MS;
    }
  });

  it("必须向上游传入 AbortSignal（无 signal 则视为回归）", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://example.test";
    process.env.LLM_TIMEOUT_MS = "1000";

    let capturedSignal: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { signal?: unknown }) => {
        capturedSignal = init?.signal;
        return {
          ok: true,
          json: async () => ({
            model: "m",
            usage: {},
            choices: [{ message: { content: "ok" } }],
          }),
        };
      }),
    );

    try {
      await chatCompletion([{ role: "user", content: "x" }], { art: "bazi" });
      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    } finally {
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_TIMEOUT_MS;
    }
  });

  it("getLlmTimeoutMs 对非法值回落默认 60s", async () => {
    const { getLlmTimeoutMs } = await import("./client");
    delete process.env.LLM_TIMEOUT_MS;
    expect(getLlmTimeoutMs()).toBe(60_000);
    process.env.LLM_TIMEOUT_MS = "abc";
    expect(getLlmTimeoutMs()).toBe(60_000);
    process.env.LLM_TIMEOUT_MS = "-5";
    expect(getLlmTimeoutMs()).toBe(60_000);
    process.env.LLM_TIMEOUT_MS = "1500";
    expect(getLlmTimeoutMs()).toBe(1500);
    delete process.env.LLM_TIMEOUT_MS;
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

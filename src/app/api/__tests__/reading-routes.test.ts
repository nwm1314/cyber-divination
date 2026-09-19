/**
 * 解读与登录 route 集成测试（GAP-1 · 波次 1 收尾）
 *
 * 覆盖最后 5 个 route：
 * - POST /api/auth/login          开发凭证登录（生产必须拒绝）
 * - GET  /api/reading/status      LLM 配置探测（禁止泄露 Key/URL/model）
 * - POST /api/reading             八字解读（权威重算 + 同源 + 限流）
 * - POST /api/reading/ziwei       紫微解读（同上）
 * - POST /api/reading/liuyao      六爻解读（同上）
 *
 * 不触达真实 LLM：只断言"请求边界"（4xx），不依赖网络。
 * 这些边界正是本轮 P0「服务端权威计算」「同源校验」「限流」的运行时防线。
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { resetUserStoreForTests } from "@/lib/auth/users";
import {
  getMemoryRateLimiter,
  setRateLimiterForTests,
} from "@/lib/api/rate-limit";
import { makeRequest } from "@/test/api-helpers";

import * as loginRoute from "@/app/api/auth/login/route";
import * as readingStatusRoute from "@/app/api/reading/status/route";
import * as readingRoute from "@/app/api/reading/route";
import * as readingZiweiRoute from "@/app/api/reading/ziwei/route";
import * as readingLiuyaoRoute from "@/app/api/reading/liuyao/route";

const PROFILE: BirthProfile = {
  id: "p-read",
  name: "解读",
  gender: "male",
  solarDate: "1990-01-01",
  birthTime: "12:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

beforeEach(() => {
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();
  process.env.AUTH_SECRET = "test-secret-value-for-reading-tests-1234";
});

describe("POST /api/auth/login · 开发凭证登录", () => {
  it("开发环境合法邮箱 → 200 + 会话 cookie", async () => {
    const res = await loginRoute.POST(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: "dev@example.com", displayName: "开发者" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: { authenticated: boolean; userId: string };
      user: { email: string };
    };
    expect(body.session.authenticated).toBe(true);
    expect(body.user.email).toBe("dev@example.com");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("生产环境 → 403（禁止开发假登录）", async () => {
    const prev = process.env.NODE_ENV;
    // @ts-expect-error NODE_ENV 在 @types/node 中为只读，测试期需覆盖以验证生产分支
    process.env.NODE_ENV = "production";
    try {
      const res = await loginRoute.POST(
        makeRequest("/api/auth/login", {
          method: "POST",
          body: { email: "dev@example.com" },
        }),
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain("Magic Link");
    } finally {
      // @ts-expect-error 同上：恢复测试前的 NODE_ENV
      process.env.NODE_ENV = prev;
    }
  });

  it("跨站 Origin → 403", async () => {
    const res = await loginRoute.POST(
      makeRequest("/api/auth/login", {
        method: "POST",
        origin: "https://evil.example",
        body: { email: "dev@example.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("无效邮箱 → 400", async () => {
    const res = await loginRoute.POST(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: "bad" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("超限 → 429 + Retry-After", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await loginRoute.POST(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: "a@example.com" },
      }),
    );
    const limited = await loginRoute.POST(
      makeRequest("/api/auth/login", {
        method: "POST",
        body: { email: "a@example.com" },
      }),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("GET /api/reading/status · 只暴露布尔", () => {
  it("200 且响应体不含 Key / base URL / model 名", async () => {
    process.env.LLM_API_KEY = "sk-super-secret-key-value-123456";
    process.env.LLM_BASE_URL = "https://api.internal.example/v1";
    process.env.LLM_MODEL = "gpt-4o-mini";
    try {
      const res = await readingStatusRoute.GET();
      expect(res.status).toBe(200);
      const raw = JSON.stringify(await res.json());
      expect(raw).not.toContain("sk-super-secret");
      expect(raw).not.toContain("api.internal.example");
      expect(raw).not.toContain("gpt-4o-mini");
      expect(raw).toContain("llmConfigured");
    } finally {
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_MODEL;
    }
  });
});

describe("POST /api/reading · 八字解读边界", () => {
  it("跨站 Origin → 403", async () => {
    const res = await readingRoute.POST(
      makeRequest("/api/reading", {
        method: "POST",
        origin: "https://evil.example",
        body: { profile: PROFILE, mode: "llm" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("超限 → 429 + Retry-After（reading 桶）", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await readingRoute.POST(
      makeRequest("/api/reading", {
        method: "POST",
        body: { profile: PROFILE, mode: "llm" },
      }),
    );
    const limited = await readingRoute.POST(
      makeRequest("/api/reading", {
        method: "POST",
        body: { profile: PROFILE, mode: "llm" },
      }),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("缺少权威输入 → 400（拒绝伪造/legacy 盘）", async () => {
    const res = await readingRoute.POST(
      makeRequest("/api/reading", {
        method: "POST",
        body: {
          // 只给伪造 chart、不给 profile、meta 里也无 authoritativeInput
          chart: {
            profileId: "p-read",
            pillars: { day: { stem: "伪", branch: "造" } },
            dayMaster: "伪",
            meta: {},
          },
          mode: "llm",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    // 错误文案应说明需要权威输入，且不泄露内部细节
    expect(body.error.message).toBeTruthy();
    expect(body.error.message).not.toMatch(/stack|at Object|node_modules/i);
  });

  it("无效出生信息 → 400", async () => {
    const res = await readingRoute.POST(
      makeRequest("/api/reading", {
        method: "POST",
        body: { profile: { ...PROFILE, solarDate: "nope" }, mode: "llm" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/reading/ziwei · 边界", () => {
  it("跨站 Origin → 403", async () => {
    const res = await readingZiweiRoute.POST(
      makeRequest("/api/reading/ziwei", {
        method: "POST",
        origin: "https://evil.example",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("缺少 chart → 400", async () => {
    const res = await readingZiweiRoute.POST(
      makeRequest("/api/reading/ziwei", {
        method: "POST",
        body: { viewMode: "plain", mode: "llm" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("超限 → 429", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await readingZiweiRoute.POST(
      makeRequest("/api/reading/ziwei", {
        method: "POST",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    const limited = await readingZiweiRoute.POST(
      makeRequest("/api/reading/ziwei", {
        method: "POST",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    expect(limited.status).toBe(429);
  });
});

describe("POST /api/reading/liuyao · 边界", () => {
  it("跨站 Origin → 403", async () => {
    const res = await readingLiuyaoRoute.POST(
      makeRequest("/api/reading/liuyao", {
        method: "POST",
        origin: "https://evil.example",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("缺少 chart → 400", async () => {
    const res = await readingLiuyaoRoute.POST(
      makeRequest("/api/reading/liuyao", {
        method: "POST",
        body: { viewMode: "plain", mode: "llm" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("超限 → 429", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await readingLiuyaoRoute.POST(
      makeRequest("/api/reading/liuyao", {
        method: "POST",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    const limited = await readingLiuyaoRoute.POST(
      makeRequest("/api/reading/liuyao", {
        method: "POST",
        body: { chart: {}, viewMode: "plain", mode: "llm" },
      }),
    );
    expect(limited.status).toBe(429);
  });
});

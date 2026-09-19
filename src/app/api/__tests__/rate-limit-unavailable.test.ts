/**
 * 限流后端不可用时的行为（§2.6-1）
 *
 * 背景：RedisRateLimiter.check / checkRateLimit / enforceRateLimit 三处都无
 * try/catch，且限流调用在鉴权之前。Upstash 不可达时异常冒到 Next 变成裸 500，
 * 把本该给出的 401/403 掩盖掉（e2e critical-flows.spec.ts:62 / :77 因此失败）。
 *
 * 期望的策略（本轮决策）：
 * - 鉴权答案优先于基础设施状态：本来就会被拒的请求，限流挂了也必须是 401/403
 * - 会被正常服务的请求：fail-closed，503 + Retry-After，禁止静默放行
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  enforceRateLimit,
  setRateLimiterForTests,
} from "@/lib/api/rate-limit";
import { resetCloudStoreForTests } from "@/lib/storage/cloud-store";
import { resetUserStoreForTests } from "@/lib/auth/users";
import { createTestUser, makeRequest } from "@/test/api-helpers";
import * as chartsRoute from "@/app/api/charts/route";
import * as deleteRoute from "@/app/api/account/delete/route";

/** 模拟 Upstash 不可达：与 getaddrinfo ENOTFOUND 同形的传输错误 */
function brokenLimiter() {
  return {
    check: () =>
      Promise.reject(
        Object.assign(new TypeError("fetch failed"), {
          cause: Object.assign(new Error("getaddrinfo ENOTFOUND redis.invalid"), {
            code: "ENOTFOUND",
            hostname: "redis.invalid",
          }),
        }),
      ),
  };
}

let token: string;

beforeEach(async () => {
  resetCloudStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(null);
  token = (await createTestUser("rl-down@example.com", "限流故障")).token;
});

describe("限流后端不可用 · 鉴权答案不被掩盖", () => {
  beforeEach(() => setRateLimiterForTests(brokenLimiter()));

  it("跨站匿名写操作仍返回 403，而不是裸 500", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        origin: "http://evil.example",
        body: { chart: { forged: true } },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("匿名删除账号仍返回 401，而不是裸 500", async () => {
    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("限流后端不可用 · 可被服务的请求 fail-closed", () => {
  beforeEach(() => setRateLimiterForTests(brokenLimiter()));

  it("已登录且同源的写操作 → 503 且带 Retry-After", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", { method: "POST", token, body: {} }),
    );
    expect(res.status).toBe(503);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    // 传输错误原文不得进入响应体
    expect(JSON.stringify(body)).not.toMatch(/ENOTFOUND|redis\.invalid|fetch failed/);
  });

  it("enforceRateLimit 把原始错误留在服务端而不是抛穿", async () => {
    const res = await enforceRateLimit(
      makeRequest("/api/charts", { token }),
      "crud",
      "api.charts.list",
    );
    expect(res?.status).toBe(503);
  });
});

describe("限流正常时行为不变", () => {
  it("健康的限流器仍按阈值给 429", async () => {
    let n = 0;
    setRateLimiterForTests({
      check: () => {
        n += 1;
        return { allowed: n <= 1, limit: 1, remaining: 0, resetMs: 60_000 };
      },
    });
    const first = await chartsRoute.GET(makeRequest("/api/charts", { token }));
    expect(first.status).toBe(200);
    const second = await chartsRoute.GET(makeRequest("/api/charts", { token }));
    expect(second.status).toBe(429);
  });
});

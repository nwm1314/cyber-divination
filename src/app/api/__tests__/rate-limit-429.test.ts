/**
 * 限流 429 + Retry-After 断言（GAP-1 · 波次 1）
 *
 * 背景（P1）：`checkRateLimit` 此前只覆盖 8 个路由，所有 `[id]` CRUD 与
 * `account/export` **完全无限流**，可高频枚举 id 拖库。修复引入
 * `enforceRateLimit` 覆盖 19 个 handler。
 *
 * 本文件从新覆盖的 handler 中抽取 3 个（charts 列表 / people 列表 /
 * account export）断言：
 * - 超限后返回 429
 * - 附带 Retry-After 与 X-RateLimit-* 头
 * - 429 发生在鉴权之前（不因未登录而绕过限流）
 * - 限流按桶 + clientKey 隔离，未超限的桶不受影响
 *
 * 通过 setRateLimiterForTests 注入内存限流器并调低阈值，避免依赖环境变量。
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MemoryRateLimiter,
  setRateLimiterForTests,
} from "@/lib/api/rate-limit";
import { resetCloudStoreForTests } from "@/lib/storage/cloud-store";
import { resetCloudPeopleStoreForTests } from "@/lib/storage/cloud-person-store";
import { resetUserStoreForTests } from "@/lib/auth/users";
import { createTestUser, makeRequest } from "@/test/api-helpers";

import * as chartsRoute from "@/app/api/charts/route";
import * as peopleRoute from "@/app/api/people/route";
import * as exportRoute from "@/app/api/account/export/route";

/** 收紧到 2 次/分钟，便于断言 */
const STRICT_LIMITER = new MemoryRateLimiter();

let token: string;

beforeEach(async () => {
  resetCloudStoreForTests();
  resetCloudPeopleStoreForTests();
  resetUserStoreForTests();
  STRICT_LIMITER.reset();
  // 包一层：所有桶阈值压到 2
  setRateLimiterForTests({
    check: (key) => STRICT_LIMITER.check(key, { max: 2, windowMs: 60_000 }),
  });
  token = (await createTestUser("rl@example.com", "限流")).token;
});

function expectRateLimitHeaders(res: Response) {
  expect(res.headers.get("retry-after")).toBeTruthy();
  expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(res.headers.get("x-ratelimit-limit")).toBe("2");
  expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
}

describe("限流 · GET /api/charts（新覆盖 handler）", () => {
  it("超过阈值 → 429 且带 Retry-After", async () => {
    for (let i = 0; i < 2; i++) {
      const ok = await chartsRoute.GET(
        makeRequest("/api/charts", { token }),
      );
      expect(ok.status).toBe(200);
    }

    const limited = await chartsRoute.GET(
      makeRequest("/api/charts", { token }),
    );
    expect(limited.status).toBe(429);
    expectRateLimitHeaders(limited);

    const body = (await limited.json()) as { error: { message: string } };
    expect(body.error.message).toContain("频繁");
  });

  it("限流先于鉴权：未登录也会被限流（不能靠不带 cookie 绕过）", async () => {
    await chartsRoute.GET(makeRequest("/api/charts"));
    await chartsRoute.GET(makeRequest("/api/charts"));

    const third = await chartsRoute.GET(makeRequest("/api/charts"));
    // 直连模式下 clientKey 为 "anon"，因此未登录请求共享同一桶 → 429 而非 401
    expect(third.status).toBe(429);
  });
});

describe("限流 · GET /api/people（新覆盖 handler）", () => {
  it("超过阈值 → 429 且带 Retry-After", async () => {
    await peopleRoute.GET(makeRequest("/api/people", { token }));
    await peopleRoute.GET(makeRequest("/api/people", { token }));

    const limited = await peopleRoute.GET(
      makeRequest("/api/people", { token }),
    );
    expect(limited.status).toBe(429);
    expectRateLimitHeaders(limited);
  });
});

describe("限流 · POST /api/account/export（新覆盖 handler）", () => {
  it("超过阈值 → 429 且带 Retry-After", async () => {
    await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        body: {},
      }),
    );
    await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        body: {},
      }),
    );

    const limited = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        body: {},
      }),
    );
    expect(limited.status).toBe(429);
    expectRateLimitHeaders(limited);
  });
});

describe("限流 · 桶与身份隔离", () => {
  it("同桶共享计数：charts 超限后 people 也超限（均为 crud 桶）", async () => {
    // enforceRateLimit 的 key 为 `${bucket}:${clientKey}`，
    // charts 与 people 都使用 crud 桶 → 共享计数（这是设计意图：
    // 限制「单个客户端对 CRUD 面的总请求量」，而非每路由独立配额）。
    await chartsRoute.GET(makeRequest("/api/charts", { token }));
    await chartsRoute.GET(makeRequest("/api/charts", { token }));
    const chartsLimited = await chartsRoute.GET(
      makeRequest("/api/charts", { token }),
    );
    expect(chartsLimited.status).toBe(429);

    const peopleLimited = await peopleRoute.GET(
      makeRequest("/api/people", { token }),
    );
    expect(peopleLimited.status).toBe(429);
  });

  it("不同 clientKey 各自独立计数（可信代理模式）", async () => {
    process.env.RATE_LIMIT_TRUSTED_PROXY = "1";
    try {
      await chartsRoute.GET(
        makeRequest("/api/charts", { token, headers: { "x-real-ip": "10.0.0.1" } }),
      );
      await chartsRoute.GET(
        makeRequest("/api/charts", { token, headers: { "x-real-ip": "10.0.0.1" } }),
      );
      const ip1Limited = await chartsRoute.GET(
        makeRequest("/api/charts", { token, headers: { "x-real-ip": "10.0.0.1" } }),
      );
      expect(ip1Limited.status).toBe(429);

      // 另一个 IP 的桶仍有余量
      const ip2Ok = await chartsRoute.GET(
        makeRequest("/api/charts", { token, headers: { "x-real-ip": "10.0.0.2" } }),
      );
      expect(ip2Ok.status).toBe(200);
    } finally {
      delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    }
  });
});

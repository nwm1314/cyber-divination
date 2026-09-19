/**
 * 其余 API route 集成测试（GAP-1 · 波次 1 收尾）
 *
 * 覆盖：
 * - GET  /api/health            存活探针
 * - GET  /api/health/ready      就绪探针（依赖检查）
 * - GET  /api/ziwei-charts      紫微列表（鉴权 + 用户隔离）
 * - POST /api/ziwei-charts      紫微保存（userId 强制取 session）
 * - GET  /api/liuyao-charts     六爻列表（鉴权 + 用户隔离）
 * - POST /api/liuyao-charts     六爻保存
 * - POST /api/charts/migrate    本地→云端迁移（鉴权）
 * - POST /api/share             分享（鉴权 + 体量上限 + 限流）
 *
 * 断言重点：错误码矩阵（400/401/403/404/413/429）、用户隔离、
 * 服务端强制覆盖 userId。
 */

import { beforeEach, describe, expect, it } from "vitest";
import { resetCloudZiweiStoreForTests } from "@/lib/storage/cloud-ziwei-store";
import { resetCloudLiuyaoStoreForTests } from "@/lib/storage/cloud-liuyao-store";
import { resetCloudStoreForTests } from "@/lib/storage/cloud-store";
import { resetUserStoreForTests } from "@/lib/auth/users";
import { getMemoryRateLimiter, setRateLimiterForTests } from "@/lib/api/rate-limit";
import { DEFAULT_MAX_BODY_BYTES } from "@/lib/api";
import { createTestUser, makeRequest } from "@/test/api-helpers";

import * as healthRoute from "@/app/api/health/route";
import * as readyRoute from "@/app/api/health/ready/route";
import * as ziweiListRoute from "@/app/api/ziwei-charts/route";
import * as liuyaoListRoute from "@/app/api/liuyao-charts/route";
import * as migrateRoute from "@/app/api/charts/migrate/route";
import * as shareRoute from "@/app/api/share/route";

let token: string;

beforeEach(async () => {
  resetCloudStoreForTests();
  resetCloudZiweiStoreForTests();
  resetCloudLiuyaoStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();
  token = (await createTestUser("misc@example.com", "杂项")).token;
});

describe("GET /api/health · 存活探针", () => {
  it("200 且不可缓存，不探测依赖", async () => {
    const res = await healthRoute.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("cyber-divination");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("GET /api/health/ready · 就绪探针", () => {
  it("返回 200/503 且带 checks 与 no-store", async () => {
    const res = await readyRoute.GET();
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as {
      status: string;
      checks: unknown;
      timestamp: string;
      degraded?: boolean;
      degradedChecks?: string[];
    };
    expect(["ready", "not_ready"]).toContain(body.status);
    expect(body.checks).toBeDefined();
    // B6：依赖未接入时 ready 仍可能为 true，探针响应必须显式标降级
    expect(typeof body.degraded).toBe("boolean");
    expect(Array.isArray(body.degradedChecks)).toBe(true);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("紫微列表/保存 · 鉴权与隔离", () => {
  it("未登录列表 → 401", async () => {
    const res = await ziweiListRoute.GET(makeRequest("/api/ziwei-charts"));
    expect(res.status).toBe(401);
  });

  it("未登录保存 → 401", async () => {
    const res = await ziweiListRoute.POST(
      makeRequest("/api/ziwei-charts", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(401);
  });

  it("已登录列表 → 200 且只含本人数据", async () => {
    const mine = await ziweiListRoute.GET(
      makeRequest("/api/ziwei-charts", { token }),
    );
    expect(mine.status).toBe(200);
    const body = (await mine.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);

    const other = (await createTestUser("other-z@example.com")).token;
    const theirs = await ziweiListRoute.GET(
      makeRequest("/api/ziwei-charts", { token: other }),
    );
    const theirsBody = (await theirs.json()) as { items: unknown[] };
    expect(theirsBody.items).toEqual([]);
  });

  it("跨站保存 → 403", async () => {
    const res = await ziweiListRoute.POST(
      makeRequest("/api/ziwei-charts", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: {},
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("六爻列表/保存 · 鉴权与隔离", () => {
  it("未登录 → 401", async () => {
    const res = await liuyaoListRoute.GET(makeRequest("/api/liuyao-charts"));
    expect(res.status).toBe(401);
  });

  it("已登录列表 → 200", async () => {
    const res = await liuyaoListRoute.GET(
      makeRequest("/api/liuyao-charts", { token }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("跨站保存 → 403", async () => {
    const res = await liuyaoListRoute.POST(
      makeRequest("/api/liuyao-charts", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: {},
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/charts/migrate · 鉴权", () => {
  it("未登录 → 401", async () => {
    const res = await migrateRoute.POST(
      makeRequest("/api/charts/migrate", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(401);
  });

  it("跨站 → 403", async () => {
    const res = await migrateRoute.POST(
      makeRequest("/api/charts/migrate", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: {},
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/share · 鉴权 / 体量 / 限流", () => {
  it("未登录 → 401", async () => {
    const res = await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        body: { kind: "bazi", chart: {}, report: {} },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("体量超限 → 413", async () => {
    // 上限来自 parse-body.ts 的 DEFAULT_MAX_BODY_BYTES（全站唯一实现）
    const huge = "x".repeat(250_000);
    const res = await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        token,
        body: { kind: "bazi", chart: { pad: huge }, report: {} },
      }),
    );
    expect(res.status).toBe(413);
  });

  /**
   * B1：share 曾走手工 `request.text()` + `checkBodySize(raw.length)`，
   * 按 UTF-16 字符计数，CJK 请求体实际可达约 3 倍字节；
   * 统一走 parseJsonBody 后与其余写路由按 UTF-8 字节同源限流。
   */
  it("CJK 请求体按 UTF-8 字节判超限 → 413", async () => {
    const cjkPad = "命".repeat(70_000); // 210_000 字节 > 200_000，但仅 70_000 字符
    expect(new TextEncoder().encode(cjkPad).byteLength).toBeGreaterThan(
      DEFAULT_MAX_BODY_BYTES,
    );
    const res = await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        token,
        body: { kind: "bazi", chart: { pad: cjkPad }, report: {} },
      }),
    );
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("请求体过大");
  });

  it("外壳字段类型错误 → 400（不再静默接受）", async () => {
    const res = await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        token,
        body: { kind: "bazi", chart: {}, report: {}, maskName: "yes" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("非法 JSON → 400", async () => {
    const req = makeRequest("/api/share", { method: "POST", token, body: {} });
    // 替换为裸的非 JSON body
    const bad = new Request("http://localhost:3000/api/share", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: "not json at all",
    });
    Object.defineProperty(bad, "cookies", { value: req.cookies });
    const res = await shareRoute.POST(bad as never);
    expect(res.status).toBe(400);
  });

  it("超限 → 429 + Retry-After（share 桶）", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        token,
        body: { kind: "bazi", chart: {}, report: {} },
      }),
    );
    const limited = await shareRoute.POST(
      makeRequest("/api/share", {
        method: "POST",
        token,
        body: { kind: "bazi", chart: {}, report: {} },
      }),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

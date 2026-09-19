import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "DATABASE_URL",
  "CLOUD_STORE_DRIVER",
  "RATE_LIMIT_DRIVER",
  "SHARE_STORE_DRIVER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

function snapshotEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearRelated() {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
}

describe("runReadinessChecks（T302）", () => {
  beforeEach(() => {
    snapshotEnv();
    clearRelated();
    vi.resetModules();
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("无 DB 要求时 db 为 skipped，整体 ready 但标记 degraded", async () => {
    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.checks.db.skipped).toBe(true);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.skipped).toBe(true);
    expect(r.ready).toBe(true);
    // B6：file 驱动下 ready 恒 true 会被读成"依赖健康"，必须显式标降级
    expect(r.degraded).toBe(true);
    expect(r.degradedChecks).toEqual(["db", "redis"]);
  });

  it("两项依赖都真正校验过时 degraded 为 false", async () => {
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.UPSTASH_REDIS_REST_URL = "https://r.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";

    vi.doMock("@/lib/db", () => ({
      isDatabaseConfigured: () => true,
      dbHealthCheck: async () => ({ ok: true, message: "ok" }),
    }));
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        async ping() {
          return "PONG";
        }
      },
    }));

    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.ready).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.degradedChecks).toEqual([]);
  });

  it("仅一项依赖未接入时，degradedChecks 只含该项", async () => {
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";

    vi.doMock("@/lib/db", () => ({
      isDatabaseConfigured: () => true,
      dbHealthCheck: async () => ({ ok: true, message: "ok" }),
    }));

    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.ready).toBe(true);
    expect(r.degraded).toBe(true);
    expect(r.degradedChecks).toEqual(["redis"]);
  });

  it("CLOUD_STORE_DRIVER=postgres 时调用 dbHealthCheck", async () => {
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";

    vi.doMock("@/lib/db", () => ({
      isDatabaseConfigured: () => true,
      dbHealthCheck: async () => ({ ok: false, message: "connection refused" }),
    }));

    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.checks.db.skipped).not.toBe(true);
    expect(r.checks.db.ok).toBe(false);
    expect(r.checks.db.message).toMatch(/connection refused/);
    expect(r.ready).toBe(false);
  });

  it("RATE_LIMIT_DRIVER=redis 但缺凭证时 redis 失败", async () => {
    process.env.RATE_LIMIT_DRIVER = "redis";
    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.checks.redis.ok).toBe(false);
    expect(r.checks.redis.message).toMatch(/UPSTASH/);
    expect(r.ready).toBe(false);
  });
});

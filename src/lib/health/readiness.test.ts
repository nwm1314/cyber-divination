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

  it("无 DB 要求时 db 为 skipped，整体 ready", async () => {
    const { runReadinessChecks } = await import("./readiness");
    const r = await runReadinessChecks();
    expect(r.checks.db.skipped).toBe(true);
    expect(r.checks.db.ok).toBe(true);
    expect(r.checks.redis.skipped).toBe(true);
    expect(r.ready).toBe(true);
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

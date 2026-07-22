/**
 * Readiness 检查逻辑（T302）
 * 供 /api/health/ready 与单测复用。
 */

import { dbHealthCheck, isDatabaseConfigured } from "@/lib/db";

export type CheckResult = {
  ok: boolean;
  message: string;
  skipped?: boolean;
};

export type ReadinessResult = {
  ready: boolean;
  checks: {
    db: CheckResult;
    redis: CheckResult;
  };
};

function needsDbCheck(): boolean {
  const driver = (process.env.CLOUD_STORE_DRIVER ?? "").trim().toLowerCase();
  if (driver === "postgres") return true;
  if (isDatabaseConfigured()) return true;
  return false;
}

function needsRedisCheck(): boolean {
  const rate = (process.env.RATE_LIMIT_DRIVER ?? "").trim().toLowerCase();
  const share = (process.env.SHARE_STORE_DRIVER ?? "").trim().toLowerCase();
  return rate === "redis" || share === "upstash";
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return {
      ok: false,
      message: "UPSTASH_REDIS_REST_URL/TOKEN 未配置",
    };
  }
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    const ok = pong === "PONG" || pong === "pong" || Boolean(pong);
    return {
      ok,
      message: ok ? "ok" : `unexpected ping: ${String(pong)}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "redis error",
    };
  }
}

/**
 * 执行 readiness 检查。
 * - DB：CLOUD_STORE_DRIVER=postgres 或已配置 DATABASE_URL 时必须 ok
 * - Redis：RATE_LIMIT_DRIVER=redis 或 SHARE_STORE_DRIVER=upstash 时必须 ok
 * - 否则对应项 skipped
 */
export async function runReadinessChecks(): Promise<ReadinessResult> {
  let db: CheckResult;
  if (needsDbCheck()) {
    const r = await dbHealthCheck();
    db = { ok: r.ok, message: r.message };
  } else {
    db = { ok: true, message: "skipped (no postgres required)", skipped: true };
  }

  let redis: CheckResult;
  if (needsRedisCheck()) {
    redis = await checkRedis();
  } else {
    redis = {
      ok: true,
      message: "skipped (no redis/upstash required)",
      skipped: true,
    };
  }

  const ready = db.ok && redis.ok;
  return { ready, checks: { db, redis } };
}

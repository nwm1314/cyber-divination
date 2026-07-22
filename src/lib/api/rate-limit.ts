/**
 * 可配置 API 限流。
 * - 默认 memory（单进程 / 本地 dev）
 * - redis：Upstash REST 固定窗口，多实例共享（T210）
 *
 * 环境变量：
 * - RATE_LIMIT_DRIVER=memory|redis（默认 memory；redis 缺凭证 fail-fast，禁止静默回落）
 * - RATE_LIMIT_READING_MAX（默认 15）
 * - RATE_LIMIT_READING_WINDOW_MS（默认 60000）
 * - RATE_LIMIT_SHARE_MAX（默认 30）
 * - RATE_LIMIT_SHARE_WINDOW_MS（默认 60000）
 * - RATE_LIMIT_AUTH_MAX（默认 10）
 * - RATE_LIMIT_AUTH_WINDOW_MS（默认 60000）
 * - RATE_LIMIT_ACCOUNT_MAX（默认 5）
 * - RATE_LIMIT_ACCOUNT_WINDOW_MS（默认 60000）
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（driver=redis 时必填，可与分享共用）
 */

import { Redis } from "@upstash/redis";

export type RateLimitBucket = "reading" | "share" | "auth" | "account";

export type RateLimitConfig = {
  max: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
};

export type RateLimiter = {
  check(key: string, config: RateLimitConfig): RateLimitResult | Promise<RateLimitResult>;
};

/** 便于单测注入的最小 Redis 接口（兼容 @upstash/redis） */
export type RateLimitRedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function getRateLimitConfig(bucket: RateLimitBucket): RateLimitConfig {
  if (bucket === "reading") {
    return {
      max: parsePositiveInt(process.env.RATE_LIMIT_READING_MAX, 15),
      windowMs: parsePositiveInt(process.env.RATE_LIMIT_READING_WINDOW_MS, 60_000),
    };
  }
  if (bucket === "share") {
    return {
      max: parsePositiveInt(process.env.RATE_LIMIT_SHARE_MAX, 30),
      windowMs: parsePositiveInt(process.env.RATE_LIMIT_SHARE_WINDOW_MS, 60_000),
    };
  }
  if (bucket === "auth") {
    return {
      max: parsePositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 10),
      windowMs: parsePositiveInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 60_000),
    };
  }
  return {
    max: parsePositiveInt(process.env.RATE_LIMIT_ACCOUNT_MAX, 5),
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_ACCOUNT_WINDOW_MS, 60_000),
  };
}

/** 内存固定窗口（单进程；Serverless 多实例不共享） */
export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { n: number; t: number }>();

  /** 测试用：清空计数 */
  reset(): void {
    this.hits.clear();
  }

  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const cur = this.hits.get(key);
    if (!cur || now - cur.t > config.windowMs) {
      this.hits.set(key, { n: 1, t: now });
      return {
        allowed: true,
        limit: config.max,
        remaining: Math.max(0, config.max - 1),
        resetMs: config.windowMs,
      };
    }
    if (cur.n >= config.max) {
      return {
        allowed: false,
        limit: config.max,
        remaining: 0,
        resetMs: Math.max(0, config.windowMs - (now - cur.t)),
      };
    }
    cur.n += 1;
    return {
      allowed: true,
      limit: config.max,
      remaining: Math.max(0, config.max - cur.n),
      resetMs: Math.max(0, config.windowMs - (now - cur.t)),
    };
  }
}

/**
 * Upstash Redis 固定窗口限流（多实例共享）。
 * key：`rl:{bucket}:{clientKey}`（传入 check 的 key 已是 bucket:clientKey）
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: RateLimitRedisLike) {}

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const n = await this.redis.incr(redisKey);
    if (n === 1) {
      await this.redis.pexpire(redisKey, config.windowMs);
    }
    let pttl = await this.redis.pttl(redisKey);
    // -1 无 TTL、-2 不存在：补过期，避免 key 永久驻留
    if (pttl < 0) {
      await this.redis.pexpire(redisKey, config.windowMs);
      pttl = config.windowMs;
    }

    if (n > config.max) {
      return {
        allowed: false,
        limit: config.max,
        remaining: 0,
        resetMs: pttl,
      };
    }
    return {
      allowed: true,
      limit: config.max,
      remaining: Math.max(0, config.max - n),
      resetMs: pttl,
    };
  }
}

const memorySingleton = new MemoryRateLimiter();

export function createRateLimiter(): RateLimiter {
  const driver = (process.env.RATE_LIMIT_DRIVER ?? "memory").toLowerCase().trim();
  if (driver === "redis") {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      throw new Error(
        "RATE_LIMIT_DRIVER=redis 时必须配置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN，禁止静默回落 memory",
      );
    }
    const redis = new Redis({ url, token });
    return new RedisRateLimiter(redis);
  }
  if (driver !== "memory" && driver !== "") {
    throw new Error(
      `无效的 RATE_LIMIT_DRIVER="${process.env.RATE_LIMIT_DRIVER}"，仅支持 memory | redis`,
    );
  }
  return memorySingleton;
}

let activeLimiter: RateLimiter | null = null;

function getActiveLimiter(): RateLimiter {
  if (!activeLimiter) {
    activeLimiter = createRateLimiter();
  }
  return activeLimiter;
}

/** 便于单测注入；传 null 清空缓存，下次按环境重建 */
export function setRateLimiterForTests(limiter: RateLimiter | null): void {
  activeLimiter = limiter;
}

export function getMemoryRateLimiter(): MemoryRateLimiter {
  return memorySingleton;
}

/**
 * 按桶 + 客户端 key 检查限流。
 * @returns allowed=false 时应返回 429
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  clientKey: string,
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(bucket);
  const key = `${bucket}:${clientKey}`;
  return Promise.resolve(getActiveLimiter().check(key, config));
}

/**
 * 兼容旧签名：true=放行，false=超限。
 * @deprecated 优先使用 checkRateLimit
 */
export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const result = memorySingleton.check(key, { max: limit, windowMs });
  return result.allowed;
}

/** 从请求头解析客户端标识（IP） */
export function clientKeyFromRequest(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "anon";
  return ip.slice(0, 64);
}

export function rateLimitResponseHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
    "Retry-After": String(Math.max(1, Math.ceil(result.resetMs / 1000))),
  };
}

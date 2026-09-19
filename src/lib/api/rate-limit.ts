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
 * - RATE_LIMIT_CRUD_MAX（默认 120）—— 覆盖 CRUD 读写与数据导出
 * - RATE_LIMIT_CRUD_WINDOW_MS（默认 60000）
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（driver=redis 时必填，可与分享共用）
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { MESSAGES } from "@/content/zh";
import { Redis } from "@upstash/redis";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import { logApi } from "./logger";
import { isIP } from "node:net";

export type RateLimitBucket = "reading" | "share" | "auth" | "account" | "crud";

export type RateLimitIdentityMode = "direct" | "trusted-proxy";

/** 直连模式下没有任何可核验身份时的共享桶键（代价见 docs/DEPLOY.md「限流身份」） */
export const ANON_CLIENT_KEY = "anon";

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
  if (bucket === "crud") {
    return {
      max: parsePositiveInt(process.env.RATE_LIMIT_CRUD_MAX, 120),
      windowMs: parsePositiveInt(process.env.RATE_LIMIT_CRUD_WINDOW_MS, 60_000),
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
/**
 * Resolve the deployment mode used for rate-limit identity.
 *
 * Direct mode deliberately ignores forwarding headers because a caller can
 * set them when the application is reached without a trusted proxy. In a
 * trusted-proxy deployment, the proxy must overwrite the IP headers before
 * forwarding the request to the application.
 */
export function getRateLimitIdentityMode(): RateLimitIdentityMode {
  const raw = process.env.RATE_LIMIT_TRUSTED_PROXY?.trim();
  if (!raw || raw === "0") return "direct";
  if (raw === "1") return "trusted-proxy";
  throw new Error(
    `无效的 RATE_LIMIT_TRUSTED_PROXY="${raw}"，仅支持 0（直连）或 1（可信代理）`,
  );
}

function normalizeIp(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > 64 || value.includes(",")) return null;
  return isIP(value) > 0 ? value : null;
}

function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() !== name) continue;
    const value = rest.join("=").trim();
    if (value) return value;
  }
  return null;
}

/**
 * 直连模式下的可核验身份（B7）。
 *
 * 转发头在直连模式下不可信（调用方可自设），因此退回到**服务端自己签发的
 * 会话 Cookie**：HMAC 由 `sessionFromToken` 校验，伪造即视为匿名，
 * 攻击者无法靠刷 Cookie 获得额外桶。只取 userId 的单向摘要，
 * 避免内部用户 id 原样进入 Redis 键与日志。
 *
 * 未登录请求仍共享 `anon` 一个桶 —— 直连部署要按用户/按 IP 分桶，
 * 必须配 `RATE_LIMIT_TRUSTED_PROXY=1` 且由代理覆写 IP 头（见 docs/DEPLOY.md）。
 */
function directModeClientKey(headers: Headers): string {
  const token = readCookieValue(headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!token) return ANON_CLIENT_KEY;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) return ANON_CLIENT_KEY;
  const digest = createHash("sha256").update(session.userId).digest("hex");
  return `user:${digest.slice(0, 16)}`;
}

/** 从请求头解析客户端标识；直连模式永远不信任客户端可控的转发头。 */
export function clientKeyFromRequest(headers: Headers): string {
  if (getRateLimitIdentityMode() === "direct") {
    return directModeClientKey(headers);
  }

  // X-Real-IP is a single-hop value in the supported proxy examples. Keep
  // X-Forwarded-For as a compatibility fallback for proxies that do not set
  // X-Real-IP; the proxy trust boundary must overwrite it, not append to it.
  const realIp = normalizeIp(headers.get("x-real-ip") ?? undefined);
  if (realIp) return realIp;

  const forwardedIp = normalizeIp(
    headers.get("x-forwarded-for")?.split(",", 1)[0],
  );
  return forwardedIp ?? ANON_CLIENT_KEY;
}

export function rateLimitResponseHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
    "Retry-After": String(Math.max(1, Math.ceil(result.resetMs / 1000))),
  };
}

/**
 * 限流后端（Upstash）不可用时的统一处理。
 *
 * 之前 RedisRateLimiter.check 抛出的传输错误会一路冒到 Next，变成没有响应体的
 * 裸 500，把本该返回的 401/403 掩盖掉。策略（本轮决策）：
 * - **鉴权答案优先于基础设施状态**：调用方给出 authorizationRejection 时先问它
 *   「这个请求本来就会被拒吗」，会则原样回它 —— 匿名/跨站请求不该因为 Redis
 *   挂了而拿到 5xx，也不该因此获得任何访问（401/403 路径本身不做任何 I/O）。
 * - 否则 fail-closed：503 + Retry-After，禁止静默放行（与「RATE_LIMIT_DRIVER=redis
 *   缺凭证时禁止静默回落 memory」同一立场）。原始错误只进服务端日志。
 *
 * @returns 正常时是限流结果；后端故障时是应当直接返回给客户端的响应
 */
export async function checkRateLimitOrRespond(
  bucket: RateLimitBucket,
  clientKey: string,
  authorizationRejection: () => NextResponse | null = () => null,
  routeLabel?: string,
): Promise<RateLimitResult | NextResponse> {
  try {
    return await checkRateLimit(bucket, clientKey);
  } catch (error) {
    // 先定下要回什么，再按实际状态记日志（回 401/403 时不该记成 503）
    const rejection = authorizationRejection();
    logApi("error", "api.rate_limiter_unavailable", {
      requestId: crypto.randomUUID(),
      route: routeLabel ?? `rate-limit:${bucket}`,
      bucket,
      clientKey,
      status: rejection?.status ?? 503,
      errorCode: "RATE_LIMITER_UNAVAILABLE",
      detail: error instanceof Error ? error.message : String(error),
    });
    return rejection ?? rateLimitUnavailableResponse(bucket);
  }
}

/** 限流后端不可用时的 503 响应（fail-closed） */
export function rateLimitUnavailableResponse(
  bucket: RateLimitBucket,
): NextResponse {
  const { windowMs } = getRateLimitConfig(bucket);
  const resetMs = Math.max(1000, windowMs);
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: MESSAGES.serviceUnavailable,
      },
    },
    {
      status: 503,
      headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
    },
  );
}

/** 判别 checkRateLimitOrRespond 的返回：是应当直接回给客户端的响应，还是限流结果 */
export function isRateLimitResponse(
  value: RateLimitResult | NextResponse,
): value is NextResponse {
  return !("allowed" in value);
}

/**
 * 便捷入口：按桶检查限流，超限时返回可直接使用的 429 响应。
 *
 * 用法：
 * ```ts
 * const limited = await enforceRateLimit(request, "crud", "api.charts.get");
 * if (limited) return limited;
 * ```
 *
 * 背景（P1）：此前 `checkRateLimit` 只覆盖 8 个路由，
 * 所有 `[id]` CRUD 与 `account/export` **完全无限流**，
 * 攻击者可高频枚举 id 拖库或消耗 DB 连接。
 *
 * @returns 超限时返回 429 NextResponse；放行时返回 null
 */
export async function enforceRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  routeLabel: string,
  authorizationRejection?: () => NextResponse | null,
): Promise<NextResponse | null> {
  const clientKey = clientKeyFromRequest(request.headers);
  const outcome = await checkRateLimitOrRespond(
    bucket,
    clientKey,
    authorizationRejection,
    routeLabel,
  );
  if (isRateLimitResponse(outcome)) return outcome;
  const rl = outcome;
  if (rl.allowed) return null;

  logApi("warn", "api.rate_limited", {
    requestId: crypto.randomUUID(),
    route: routeLabel,
    method: request.method,
    status: 429,
    clientKey,
    errorCode: "RATE_LIMITED",
  });

  return NextResponse.json(
    {
      error: {
        code: ErrorCode.INVALID_PROFILE,
        message: MESSAGES.rateLimited,
      },
    },
    { status: 429, headers: rateLimitResponseHeaders(rl) },
  );
}

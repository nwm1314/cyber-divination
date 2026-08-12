import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientKeyFromRequest,
  createRateLimiter,
  getRateLimitIdentityMode,
  getMemoryRateLimiter,
  getRateLimitConfig,
  rateLimit,
  RedisRateLimiter,
  setRateLimiterForTests,
  type RateLimitRedisLike,
} from "@/lib/api/rate-limit";
import { resolveRequestId } from "@/lib/api/request-id";
import { logApi } from "@/lib/api/logger";

describe("rate-limit config", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    getMemoryRateLimiter().reset();
    setRateLimiterForTests(null);
  });

  it("默认 reading/share/auth/account 限额", () => {
    delete process.env.RATE_LIMIT_READING_MAX;
    delete process.env.RATE_LIMIT_SHARE_MAX;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_ACCOUNT_MAX;
    expect(getRateLimitConfig("reading")).toEqual({
      max: 15,
      windowMs: 60_000,
    });
    expect(getRateLimitConfig("share")).toEqual({
      max: 30,
      windowMs: 60_000,
    });
    expect(getRateLimitConfig("auth")).toEqual({
      max: 10,
      windowMs: 60_000,
    });
    expect(getRateLimitConfig("account")).toEqual({
      max: 5,
      windowMs: 60_000,
    });
  });

  it("环境变量可覆盖", () => {
    process.env.RATE_LIMIT_READING_MAX = "3";
    process.env.RATE_LIMIT_READING_WINDOW_MS = "1000";
    expect(getRateLimitConfig("reading")).toEqual({
      max: 3,
      windowMs: 1000,
    });
  });

  it("超限 allowed=false（可触发 429）", async () => {
    process.env.RATE_LIMIT_READING_MAX = "2";
    process.env.RATE_LIMIT_READING_WINDOW_MS = "60000";
    getMemoryRateLimiter().reset();
    setRateLimiterForTests(getMemoryRateLimiter());

    const a = await checkRateLimit("reading", "test-ip");
    const b = await checkRateLimit("reading", "test-ip");
    const c = await checkRateLimit("reading", "test-ip");

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
  });

  it("兼容旧 rateLimit 签名", () => {
    getMemoryRateLimiter().reset();
    expect(rateLimit("legacy:1", 1, 60_000)).toBe(true);
    expect(rateLimit("legacy:1", 1, 60_000)).toBe(false);
  });
});

describe("rate-limit identity", () => {
  it("直连模式忽略伪造的 forwarded headers", () => {
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "198.51.100.20",
    });

    expect(getRateLimitIdentityMode()).toBe("direct");
    expect(clientKeyFromRequest(headers)).toBe("anon");
  });

  it("可信代理模式使用代理提供的真实 IP", () => {
    process.env.RATE_LIMIT_TRUSTED_PROXY = "1";
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.2",
      "x-real-ip": "198.51.100.20",
    });

    expect(getRateLimitIdentityMode()).toBe("trusted-proxy");
    expect(clientKeyFromRequest(headers)).toBe("198.51.100.20");
  });

  it("可信代理模式兼容仅提供 X-Forwarded-For 的代理，并拒绝非法值", () => {
    process.env.RATE_LIMIT_TRUSTED_PROXY = "1";
    expect(
      clientKeyFromRequest(
        new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.2" }),
      ),
    ).toBe("203.0.113.10");
    expect(
      clientKeyFromRequest(new Headers({ "x-forwarded-for": "not-an-ip" })),
    ).toBe("anon");
  });

  it("拒绝未支持的代理模式配置", () => {
    process.env.RATE_LIMIT_TRUSTED_PROXY = "yes";
    expect(() => clientKeyFromRequest(new Headers())).toThrow(/RATE_LIMIT_TRUSTED_PROXY/);
  });
});

describe("RedisRateLimiter（T210）", () => {
  function mockRedis(): RateLimitRedisLike & {
    map: Map<string, { n: number; exp: number }>;
  } {
    const map = new Map<string, { n: number; exp: number }>();
    return {
      map,
      async incr(key: string) {
        const cur = map.get(key);
        if (!cur) {
          map.set(key, { n: 1, exp: -1 });
          return 1;
        }
        cur.n += 1;
        return cur.n;
      },
      async pexpire(key: string, ms: number) {
        const cur = map.get(key);
        if (cur) cur.exp = Date.now() + ms;
        return 1;
      },
      async pttl(key: string) {
        const cur = map.get(key);
        if (!cur) return -2;
        if (cur.exp < 0) return -1;
        return Math.max(0, cur.exp - Date.now());
      },
    };
  }

  it("固定窗口超限 allowed=false", async () => {
    const redis = mockRedis();
    const limiter = new RedisRateLimiter(redis);
    const cfg = { max: 2, windowMs: 60_000 };

    const a = await limiter.check("reading:ip1", cfg);
    const b = await limiter.check("reading:ip1", cfg);
    const c = await limiter.check("reading:ip1", cfg);

    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(1);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(0);
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
    expect(redis.map.has("rl:reading:ip1")).toBe(true);
  });

  it("跨「实例」共享同一 mock 计数", async () => {
    const redis = mockRedis();
    const a = new RedisRateLimiter(redis);
    const b = new RedisRateLimiter(redis);
    const cfg = { max: 2, windowMs: 60_000 };

    expect((await a.check("reading:shared", cfg)).allowed).toBe(true);
    expect((await b.check("reading:shared", cfg)).allowed).toBe(true);
    expect((await a.check("reading:shared", cfg)).allowed).toBe(false);
  });

  it("createRateLimiter redis 缺凭证 fail-fast", () => {
    const prev = { ...process.env };
    try {
      process.env.RATE_LIMIT_DRIVER = "redis";
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      expect(() => createRateLimiter()).toThrow(/禁止静默回落|必须配置/);
    } finally {
      process.env = { ...prev };
    }
  });
});

describe("request-id", () => {
  it("无头时生成 uuid", () => {
    const id = resolveRequestId(new Headers());
    expect(id.length).toBeGreaterThan(10);
  });

  it("尊重合法 x-request-id", () => {
    const h = new Headers({ "x-request-id": "req-abc-123" });
    expect(resolveRequestId(h)).toBe("req-abc-123");
  });
});

describe("logger scrub", () => {
  it("不输出 apiKey 字段明文", () => {
    const lines: string[] = [];
    const orig = console.info;
    console.info = (msg?: unknown) => {
      lines.push(String(msg));
    };
    try {
      logApi("info", "test.scrub", {
        requestId: "r1",
        route: "/api/reading",
        apiKey: "sk-secret-should-not-appear",
        Authorization: "Bearer sk-xxx",
        prompt: "full system prompt secret",
      });
      const line = lines[0] ?? "";
      expect(line).toContain("[redacted]");
      expect(line).not.toContain("sk-secret-should-not-appear");
      expect(line).not.toContain("Bearer sk-xxx");
      expect(line).not.toContain("full system prompt secret");
    } finally {
      console.info = orig;
    }
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientKeyFromRequest,
  createRateLimiter,
  enforceRateLimit,
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
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
} from "@/lib/auth/session";

/**
 * P1 回归：CRUD / 导出路由此前完全无限流。
 * 攻击场景：登录后循环 GET /api/charts/{id} 遍历 id 拖库。
 */
describe("enforceRateLimit（P1 回归）", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    getMemoryRateLimiter().reset();
    setRateLimiterForTests(null);
  });

  function req(method = "GET", headers: Record<string, string> = {}) {
    return new Request("https://app.test/api/charts", { method, headers });
  }

  it("额度内放行（返回 null）", async () => {
    process.env.RATE_LIMIT_CRUD_MAX = "3";
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    const r = await enforceRateLimit(req(), "crud", "api.charts.list");
    expect(r).toBeNull();
  });

  it("超限时返回 429 并带限流响应头", async () => {
    process.env.RATE_LIMIT_CRUD_MAX = "2";
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;

    expect(await enforceRateLimit(req(), "crud", "api.charts.get")).toBeNull();
    expect(await enforceRateLimit(req(), "crud", "api.charts.get")).toBeNull();
    const third = await enforceRateLimit(req(), "crud", "api.charts.get");

    expect(third).not.toBeNull();
    expect(third!.status).toBe(429);
    expect(third!.headers.get("Retry-After")).toBeTruthy();
    expect(third!.headers.get("X-RateLimit-Limit")).toBe("2");
    const body = (await third!.json()) as { error?: { message?: string } };
    expect(body.error?.message).toMatch(/频繁/);
  });

  it("crud 桶默认 120/分钟", () => {
    delete process.env.RATE_LIMIT_CRUD_MAX;
    delete process.env.RATE_LIMIT_CRUD_WINDOW_MS;
    expect(getRateLimitConfig("crud")).toEqual({ max: 120, windowMs: 60_000 });
  });

  it("crud 与其他桶相互隔离（不同桶不共享计数）", async () => {
    process.env.RATE_LIMIT_CRUD_MAX = "1";
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;

    expect(await enforceRateLimit(req(), "crud", "a")).toBeNull();
    // crud 已用尽
    expect(await enforceRateLimit(req(), "crud", "a")).not.toBeNull();
    // reading 桶不受影响
    expect(await enforceRateLimit(req(), "reading", "b")).toBeNull();
  });
});

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
  /**
   * 本块会改写限流相关变量；原实现无清理，会把 RATE_LIMIT_TRUSTED_PROXY
   * 泄漏给同文件后续 describe（顺序敏感的偶发失败）。此处统一快照/还原。
   */
  const MANAGED_ENV = [
    "RATE_LIMIT_TRUSTED_PROXY",
    "RATE_LIMIT_CRUD_MAX",
    "RATE_LIMIT_CRUD_WINDOW_MS",
  ] as const;
  const savedIdentityEnv: Partial<
    Record<(typeof MANAGED_ENV)[number], string | undefined>
  > = {};
  for (const key of MANAGED_ENV) savedIdentityEnv[key] = process.env[key];

  afterEach(() => {
    for (const key of MANAGED_ENV) {
      const value = savedIdentityEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    getMemoryRateLimiter().reset();
    setRateLimiterForTests(null);
  });

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

  /**
   * B7：直连模式此前对所有请求返回常量 "anon" → 全站共享一个桶，
   * 单个访客即可把所有人一起限死。现改为使用**服务端签发的会话**做身份：
   * HMAC 不可伪造，因此不会给攻击者凭空造桶的能力。
   */
  const cookieOf = (token: string) =>
    new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` });

  it("直连：已验签会话获得独立且稳定的桶键，且不泄露明文 userId", () => {
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    const token = createSessionToken({
      id: "usr_direct_a",
      email: "direct-a@example.com",
      displayName: "A",
    });

    const key = clientKeyFromRequest(cookieOf(token));
    expect(key).toMatch(/^user:[0-9a-f]{16}$/);
    expect(key).not.toContain("usr_direct_a");
    expect(key).not.toContain("direct-a");
    expect(clientKeyFromRequest(cookieOf(token))).toBe(key);
  });

  it("直连：不同用户不同桶，未登录共享 anon 桶", () => {
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    const a = clientKeyFromRequest(
      cookieOf(
        createSessionToken({ id: "usr_1", email: "u1@example.com" }),
      ),
    );
    const b = clientKeyFromRequest(
      cookieOf(
        createSessionToken({ id: "usr_2", email: "u2@example.com" }),
      ),
    );
    expect(a).not.toBe(b);
    expect(clientKeyFromRequest(new Headers())).toBe("anon");
    expect(clientKeyFromRequest(new Headers({ cookie: "other=1" }))).toBe("anon");
  });

  it("直连：伪造或篡改的会话 Cookie 回落 anon（不获得额外额度）", () => {
    delete process.env.RATE_LIMIT_TRUSTED_PROXY;
    const valid = createSessionToken({
      id: "usr_tamper",
      email: "tamper@example.com",
    });
    const [body] = valid.split(".");
    const forgedCases = [
      "eyJzdWIiOiJ1c3JfYXR0YWNrZXIifQ.deadbeefdeadbeef",
      `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      `${valid}x`,
      "",
    ];
    for (const token of forgedCases) {
      expect(
        clientKeyFromRequest(cookieOf(token)),
        `伪造 token 不应获得独立桶: ${token.slice(0, 24)}`,
      ).toBe("anon");
    }
  });

  it("直连：一个用户用满额度不影响另一个用户（分桶隔离）", async () => {
    process.env.RATE_LIMIT_TRUSTED_PROXY = "0";
    process.env.RATE_LIMIT_CRUD_MAX = "2";
    process.env.RATE_LIMIT_CRUD_WINDOW_MS = "60000";
    setRateLimiterForTests(null);
    getMemoryRateLimiter().reset();

    const call = (token: string) =>
      enforceRateLimit(
        new Request("https://app.test/api/charts", {
          method: "GET",
          headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        }),
        "crud",
        "api.charts.list",
      );

    const tokenA = createSessionToken({ id: "usr_iso_a", email: "a@example.com" });
    const tokenB = createSessionToken({ id: "usr_iso_b", email: "b@example.com" });

    expect(await call(tokenA)).toBeNull();
    expect(await call(tokenA)).toBeNull();
    const blocked = await call(tokenA);
    expect(blocked?.status).toBe(429);
    // A 已被限，B 仍应放行；改动前两者共用 anon 桶，B 也会 429
    expect(await call(tokenB)).toBeNull();
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

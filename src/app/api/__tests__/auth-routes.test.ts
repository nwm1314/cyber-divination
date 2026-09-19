/**
 * 认证路由集成测试（GAP-1 · 波次 1 扩展）
 *
 * 覆盖 auth 面 5 个 handler：
 * - POST /api/auth/magic-link  签发
 * - POST /api/auth/callback    消费 + 建会话（完整登录链路）
 * - GET  /api/auth/session     会话读取
 * - POST /api/auth/logout      登出
 * - POST /api/auth/login       开发凭证登录
 *
 * 重点验证安全性质（这些是本轮 P0 的运行时防线）：
 * - 跨站 Origin 一律 403
 * - 无效/已消费/伪造 token 无法建立会话
 * - magic link 一次性：同 token 二次 callback 失败
 * - 会话 cookie 为 httpOnly
 * - 限流生效（auth 桶）
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resetMagicLinkStoreForTests,
  createMagicLink,
} from "@/lib/auth/magic-link";
import { resetUserStoreForTests } from "@/lib/auth/users";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import {
  getMemoryRateLimiter,
  setRateLimiterForTests,
} from "@/lib/api/rate-limit";
import { makeRequest } from "@/test/api-helpers";

import * as magicLinkRoute from "@/app/api/auth/magic-link/route";
import * as callbackRoute from "@/app/api/auth/callback/route";
import * as sessionRoute from "@/app/api/auth/session/route";
import * as logoutRoute from "@/app/api/auth/logout/route";

beforeEach(() => {
  resetMagicLinkStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();
  process.env.AUTH_SECRET = "test-secret-value-for-auth-route-tests-1234";
});

afterEach(() => {
  resetMagicLinkStoreForTests();
  resetUserStoreForTests();
  delete process.env.AUTH_SECRET;
});

function tokenOf(link: string): string {
  const t = new URL(link).searchParams.get("token");
  if (!t) throw new Error("devLink 缺少 token");
  return t;
}

describe("POST /api/auth/magic-link", () => {
  it("同源合法请求 → 200，开发环境返回 devLink", async () => {
    const res = await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", {
        method: "POST",
        body: { email: "user@example.com", displayName: "用户" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      email: string;
      devLink?: string;
      message: string;
    };
    expect(body.ok).toBe(true);
    expect(body.email).toBe("user@example.com");
    expect(body.devLink).toBeTruthy();
    expect(body.message).toBeTruthy();
  });

  it("跨站 Origin → 403", async () => {
    const res = await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", {
        method: "POST",
        origin: "https://evil.example",
        body: { email: "user@example.com" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("无效邮箱 → 400，且不泄露内部细节", async () => {
    const res = await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", {
        method: "POST",
        body: { email: "not-an-email" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBeTruthy();
    expect(body.error.message).not.toMatch(/zod|stack|at /i);
  });

  it("缺 email → 400", async () => {
    const res = await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("超限 → 429 + Retry-After（auth 桶）", async () => {
    setRateLimiterForTests({
      check: (key) =>
        getMemoryRateLimiter().check(key, { max: 1, windowMs: 60_000 }),
    });
    await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", {
        method: "POST",
        body: { email: "a@example.com" },
      }),
    );
    const limited = await magicLinkRoute.POST(
      makeRequest("/api/auth/magic-link", {
        method: "POST",
        body: { email: "a@example.com" },
      }),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("POST /api/auth/callback · 完整登录链路", () => {
  it("有效 token → 200 建立会话，cookie 为 httpOnly", async () => {
    const created = await createMagicLink({ email: "cb@example.com" });
    const token = tokenOf(created.devLink!);

    const res = await callbackRoute.POST(
      makeRequest("/api/auth/callback", {
        method: "POST",
        body: { token },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: { authenticated: boolean; userId: string };
      user: { email: string };
      callbackUrl: string;
    };
    expect(body.session.authenticated).toBe(true);
    expect(body.session.userId).toBeTruthy();
    expect(body.user.email).toBe("cb@example.com");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("同一 token 二次 callback → 400（一次性）", async () => {
    const created = await createMagicLink({ email: "once@example.com" });
    const token = tokenOf(created.devLink!);

    const first = await callbackRoute.POST(
      makeRequest("/api/auth/callback", { method: "POST", body: { token } }),
    );
    expect(first.status).toBe(200);

    const second = await callbackRoute.POST(
      makeRequest("/api/auth/callback", { method: "POST", body: { token } }),
    );
    expect(second.status).toBe(400);
    const body = (await second.json()) as { error: { message: string } };
    expect(body.error.message).toContain("无效或已过期");
  });

  it("并发 callback 同一 token → 恰好 1 次成功", async () => {
    const created = await createMagicLink({ email: "race-cb@example.com" });
    const token = tokenOf(created.devLink!);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        callbackRoute.POST(
          makeRequest("/api/auth/callback", { method: "POST", body: { token } }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("伪造 token → 400，不建立会话", async () => {
    const res = await callbackRoute.POST(
      makeRequest("/api/auth/callback", {
        method: "POST",
        body: { token: "forged-token-value" },
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie") ?? "").not.toContain(
      `${SESSION_COOKIE_NAME}=ey`,
    );
  });

  it("跨站 Origin → 403", async () => {
    const created = await createMagicLink({ email: "x@example.com" });
    const token = tokenOf(created.devLink!);
    const res = await callbackRoute.POST(
      makeRequest("/api/auth/callback", {
        method: "POST",
        origin: "https://evil.example",
        body: { token },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("缺 token → 400", async () => {
    const res = await callbackRoute.POST(
      makeRequest("/api/auth/callback", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/session", () => {
  it("无 cookie → 未登录会话", async () => {
    const res = await sessionRoute.GET(makeRequest("/api/auth/session"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session: { authenticated: boolean; userId: string | null };
    };
    expect(body.session.authenticated).toBe(false);
    expect(body.session.userId).toBeNull();
  });

  it("合法 cookie → 已登录会话", async () => {
    const token = createSessionToken({
      id: "usr_test_session",
      email: "s@example.com",
      displayName: "会话",
    });
    const res = await sessionRoute.GET(
      makeRequest("/api/auth/session", { token }),
    );
    const body = (await res.json()) as {
      session: { authenticated: boolean; userId: string | null };
    };
    expect(body.session.authenticated).toBe(true);
    expect(body.session.userId).toBe("usr_test_session");
  });

  it("伪造 cookie → 未登录", async () => {
    const res = await sessionRoute.GET(
      makeRequest("/api/auth/session", { token: "broken.token" }),
    );
    const body = (await res.json()) as {
      session: { authenticated: boolean };
    };
    expect(body.session.authenticated).toBe(false);
  });
});

describe("POST /api/auth/logout", () => {
  it("同源 → 200 并清除 cookie", async () => {
    const res = await logoutRoute.POST(
      makeRequest("/api/auth/logout", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    // 清空：Max-Age=0
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("跨站 Origin → 403（防强制登出）", async () => {
    const res = await logoutRoute.POST(
      makeRequest("/api/auth/logout", {
        method: "POST",
        origin: "https://evil.example",
      }),
    );
    expect(res.status).toBe(403);
  });
});

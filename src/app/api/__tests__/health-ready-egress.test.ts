/**
 * /api/health/ready 的出口脱敏（§2.6-2）
 *
 * 该端点无需鉴权，而 runReadinessChecks 的 checks.*.message 原本直接放驱动/依赖
 * 的原始错误文本（实测出现过 `用户 "e2e" Password 认证失败` 一类内容），会泄露
 * 内部主机名与用户名。内部诊断仍保留原文（readiness.test.ts 明确断言这一点），
 * 脱敏只发生在 HTTP 出口，原文转向服务端日志。
 *
 * 注意：不能用 toSafeErrorMessage 兜底 —— 那类中文技术文案含中文、短、无驱动特征
 * 词，会被它的 isTrustedBusinessMessage 判成「可信业务文案」而原样放行。
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/health/readiness", () => ({
  runReadinessChecks: async () => ({
    ready: false,
    degraded: false,
    degradedChecks: [],
    checks: {
      db: {
        ok: false,
        message: '用户 "e2e" Password 认证失败（host 10.0.4.21）',
      },
      redis: {
        ok: false,
        message: "getaddrinfo ENOTFOUND redis.internal.example",
      },
    },
  }),
}));

const readyRoute = await import("@/app/api/health/ready/route");

describe("GET /api/health/ready · 不泄露依赖原始错误", () => {
  it("503 响应体里不含驱动/主机/用户名信息", async () => {
    const res = await readyRoute.GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    for (const secret of [
      "Password",
      "e2e",
      "10.0.4.21",
      "ENOTFOUND",
      "redis.internal.example",
      "getaddrinfo",
    ]) {
      expect(text, `响应体不应包含 ${secret}`).not.toContain(secret);
    }
  });

  it("仍保留 ok 与降级信号供探针判断", async () => {
    const res = await readyRoute.GET();
    const body = (await res.json()) as {
      status: string;
      degraded: boolean;
      degradedChecks: string[];
      checks: Record<string, { ok: boolean; message: string }>;
    };
    expect(body.status).toBe("not_ready");
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.redis.ok).toBe(false);
    expect(typeof body.checks.db.message).toBe("string");
    expect(body.checks.db.message.length).toBeGreaterThan(0);
  });
});

/**
 * POST /api/account/export 加固测试（P2 A8 · 波次 4）
 *
 * 原缺陷：该接口为 `GET`，且无 Origin 校验、无近期认证要求。
 * 跨站 `<img src="/api/account/export">` 或顶层导航即可触发导出
 * （SameSite=Lax 的 cookie 会随顶层 GET 导航发送），使攻击者能把
 * 用户全量命盘数据引导到可观测的响应中。
 *
 * 断言：
 * - GET 被拒绝（405），不再能通过导航/图片标签触发
 * - POST 无 Origin → 403
 * - POST 跨站 Origin → 403
 * - POST 未登录 → 401
 * - POST 陈旧会话（>15 分钟）→ 403
 * - POST 合法近期会话 → 200 且带 no-store
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken } from "@/lib/auth/session";
import { findOrCreateUserByEmail, resetUserStoreForTests } from "@/lib/auth/users";
import { resetCloudStoreForTests } from "@/lib/storage/cloud-store";
import { getMemoryRateLimiter, setRateLimiterForTests } from "@/lib/api/rate-limit";
import { makeRequest } from "@/test/api-helpers";

import * as exportRoute from "@/app/api/account/export/route";

let token: string;
let userId: string;

beforeEach(async () => {
  resetCloudStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();

  const user = await findOrCreateUserByEmail({
    email: "export@example.com",
    displayName: "导出",
  });
  userId = user.id;
  token = createSessionToken(user);
});

describe("POST /api/account/export · 加固", () => {
  it("GET 已被拒绝（405 + Allow: POST），不能再靠导航触发", async () => {
    const res = exportRoute.GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("合法近期会话 + 同源 POST → 200 且响应不可缓存", async () => {
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        body: {},
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // 导出内容确实包含该用户
    const body = (await res.json()) as { user: { id: string } };
    expect(body.user.id).toBe(userId);
  });

  it("无 Origin 的 POST：生产环境拒绝（403）", async () => {
    // origin.ts 的既定策略：生产要求 Origin/Referer，开发放宽以兼容
    // curl 与测试工具。这里显式验证**生产**分支拒绝无 Origin 请求。
    const prev = process.env.NODE_ENV;
    // @ts-expect-error 测试期覆盖只读的 NODE_ENV
    process.env.NODE_ENV = "production";
    try {
      const res = await exportRoute.POST(
        makeRequest("/api/account/export", {
          method: "POST",
          token,
          origin: null,
          body: {},
        }),
      );
      expect(res.status).toBe(403);
    } finally {
      // @ts-expect-error 恢复
      process.env.NODE_ENV = prev;
    }
  });

  it("无 Origin 的 POST：开发环境放宽（既有策略，不为本修复改动）", async () => {
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        origin: null,
        body: {},
      }),
    );
    expect(res.status).toBe(200);
  });

  it("跨站 Origin → 403", async () => {
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: {},
      }),
    );
    expect(res.status).toBe(403);
  });

  it("未登录 → 401", async () => {
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(401);
  });

  it("陈旧会话（iat 超 15 分钟）→ 403 要求重新登录", async () => {
    const stale = createSessionToken(
      { id: userId, email: "export@example.com", displayName: "导出" },
      { now: Math.floor(Date.now() / 1000) - 16 * 60 },
    );
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token: stale,
        body: {},
      }),
    );
    expect(res.status).toBe(403);
  });

  it("伪造签名 token → 401", async () => {
    const forged = `${token.split(".")[0]}.AAAAforgedAAAA`;
    const res = await exportRoute.POST(
      makeRequest("/api/account/export", {
        method: "POST",
        token: forged,
        body: {},
      }),
    );
    expect(res.status).toBe(401);
  });
});

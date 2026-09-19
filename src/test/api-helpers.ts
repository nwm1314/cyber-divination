/**
 * API route 集成测试辅助（GAP-1 / 波次 1）
 *
 * 决策说明（为什么用「直接 import route handler + 构造 NextRequest」而非起独立 server）：
 * - 项目 vitest 环境为 node，无 route 级测试先例；起 server 需 next start + 端口管理，
 *   在 CI 与沙箱下不稳定，且无法注入内存 store。
 * - route handler 本身是纯函数（request, context）→ Response，直接调用即可覆盖
 *   鉴权、Origin、限流、zod 校验、权威重算、越权归属判定等全部 handler 内逻辑。
 * - 需要的真实存储用项目自带的 file 驱动 reset*ForTests() 注入内存实现
 *   （cloud-store / cloud-ziwei-store / cloud-person-store / cloud-liuyao-store），
 *   无需 DATABASE_URL。
 *
 * 唯一未被覆盖的是 Next.js 路由层本身（路径匹配、cookie 解析之外的框架行为），
 * 那部分由 e2e/critical-flows.spec.ts 与 build 门禁覆盖。
 */

import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { findOrCreateUserByEmail } from "@/lib/auth/users";
import type { User } from "@/lib/types/user";

export const TEST_ORIGIN = "http://localhost:3000";

/** 建一个真实用户并签发可用的会话 cookie 值 */
export async function createTestUser(
  email: string,
  displayName?: string,
): Promise<{ user: User; token: string }> {
  const user = await findOrCreateUserByEmail({ email, displayName });
  const token = createSessionToken(user);
  return { user, token };
}

export type RequestInitLite = {
  method?: string;
  /** 会话 token；null/undefined 表示未登录 */
  token?: string | null;
  body?: unknown;
  /** 额外请求头；传 null 可移除默认 Origin（用于测跨站拒绝） */
  headers?: Record<string, string | null>;
  /** 覆盖 Origin；默认 TEST_ORIGIN */
  origin?: string | null;
  url?: string;
};

/**
 * 构造带会话 cookie 的 NextRequest。
 * 默认带同源 Origin，因为绝大多数写操作要求同源。
 */
export function makeRequest(
  path: string,
  init: RequestInitLite = {},
): NextRequest {
  const url = init.url ?? `${TEST_ORIGIN}${path}`;
  const headers = new Headers();
  headers.set("host", new URL(url).host);

  const origin = "origin" in init ? init.origin : TEST_ORIGIN;
  if (origin) headers.set("origin", origin);

  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  for (const [k, v] of Object.entries(init.headers ?? {})) {
    if (v === null) headers.delete(k);
    else headers.set(k, v);
  }

  if (init.token) {
    // NextRequest 从 cookie header 解析 request.cookies
    const existing = headers.get("cookie");
    const pair = `${SESSION_COOKIE_NAME}=${init.token}`;
    headers.set("cookie", existing ? `${existing}; ${pair}` : pair);
  }

  return new NextRequest(url, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined
      ? { body: JSON.stringify(init.body) }
      : {}),
  });
}

/** Next.js 16 动态路由 params 是 Promise */
export function routeContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** 读取响应 JSON（结构断言用） */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** 断言响应为「不存在或无权访问」且不泄露资源是否存在 */
export async function expectOpaqueNotFound(res: Response): Promise<void> {
  if (res.status !== 404) {
    throw new Error(`期望 404，实际 ${res.status}`);
  }
  const body = await readJson<{ error?: { message?: string } }>(res);
  const message = body.error?.message ?? "";
  // 不得出现区分「存在但无权」与「不存在」的措辞
  if (/无权|forbidden|permission/i.test(message) && !/不存在或无权/.test(message)) {
    throw new Error(`404 文案泄露资源存在性: ${message}`);
  }
}

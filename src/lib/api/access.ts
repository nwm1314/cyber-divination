/**
 * 准入判定（供限流降级路径复用）
 *
 * `enforceRateLimit` 在限流后端不可用时要问一次「这个请求本来就会被拒吗」，
 * 答案必须与路由自己的内联门禁**完全一致**，否则会出现「探针放行、正式门禁拒绝」
 * 的分歧。因此这里只做判定、不重新发明响应：401 由调用方传入它自己已有的
 * `unauthorized()` 工厂，403 沿用 `assertSameOrigin` 的文案与错误码。
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import { ErrorCode } from "@/lib/types";
import { assertSameOrigin } from "./origin";

/** 跨站写请求 → 403；同源或无 Origin 场景由 assertSameOrigin 判定 */
export function originRejection(request: Request): NextResponse | null {
  const err = assertSameOrigin(request);
  if (!err) return null;
  return NextResponse.json(
    { error: { code: ErrorCode.AUTH_FORBIDDEN, message: err } },
    { status: 403 },
  );
}

/** 无有效会话 → 用调用方自己的 401 工厂造响应；有会话返回 null */
export function sessionRejection(
  request: NextRequest,
  rejectUnauthorized: () => NextResponse,
): NextResponse | null {
  const session = sessionFromToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (session.authenticated && session.userId) return null;
  return rejectUnauthorized();
}

/** 写操作面（POST/PUT/DELETE）：同源 + 已登录 */
export function writeRejection(
  request: NextRequest,
  rejectUnauthorized: () => NextResponse,
): NextResponse | null {
  return originRejection(request) ?? sessionRejection(request, rejectUnauthorized);
}

import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_REAUTH_MAX_AGE_SEC,
  sessionFromToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { deleteAccount } from "@/lib/auth/account";
import { getUserById } from "@/lib/auth/users";
import { toAppSession } from "@/lib/auth/types";
import {
  parseJsonBody,
  assertSameOrigin,
  checkRateLimit,
  clientKeyFromRequest,
  rateLimitResponseHeaders,
} from "@/lib/api";
import { deleteConfirmSchema } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request.headers);
  const rl = await checkRateLimit("account", clientKey);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: "请求过于频繁，请稍后再试",
        },
      },
      {
        status: 429,
        headers: rateLimitResponseHeaders(rl),
      },
    );
  }

  const originErr = assertSameOrigin(request);
  if (originErr) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: originErr,
        },
      },
      { status: 403 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);
  const session = sessionFromToken(token);

  if (!session.authenticated || !session.userId || !payload) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: "请先登录后再删除账号",
        },
      },
      { status: 401 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payload.iat !== "number" ||
    now - payload.iat > SESSION_REAUTH_MAX_AGE_SEC
  ) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: "删除账号前请重新登录以确认身份",
        },
      },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBody(request, deleteConfirmSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message:
            parsed.status === 413
              ? parsed.message
              : '请传入 confirm: "DELETE" 以确认删除',
        },
      },
      { status: parsed.status === 413 ? 413 : 400 },
    );
  }

  const user = await getUserById(session.userId);
  if (!user) {
    const res = NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_USER_NOT_FOUND,
          message: "账号不存在或已删除",
        },
      },
      { status: 404 },
    );
    res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
    return res;
  }

  try {
    const result = await deleteAccount(session.userId);
    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_USER_NOT_FOUND,
            message: "账号不存在或已删除",
          },
        },
        { status: 404 },
      );
    }

    const res = NextResponse.json({
      ok: true,
      userId: result.userId,
      cloudDeleted: result.cloudDeleted,
      session: toAppSession(null),
    });
    res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: "删除账号失败，云端数据未完全清理，请稍后重试",
        },
      },
      { status: 500 },
    );
  }
}

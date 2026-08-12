import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorCode } from "@/lib/types";
import { findOrCreateUserByEmail } from "@/lib/auth/users";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { toAppSession, userToSessionUser } from "@/lib/auth/types";
import type { AuthJsSession } from "@/lib/auth/types";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { assertSameOrigin, parseJsonBody } from "@/lib/api";
import {
  checkRateLimit,
  clientKeyFromRequest,
  rateLimitResponseHeaders,
} from "@/lib/api/rate-limit";

const callbackBodySchema = z.object({
  token: z.string().trim().min(1).max(256),
});

export async function POST(request: NextRequest) {
  try {
    const clientKey = clientKeyFromRequest(request.headers);
    const rl = await checkRateLimit("auth", clientKey);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
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

    const parsed = await parseJsonBody(request, callbackBodySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
            message: parsed.message,
          },
        },
        { status: parsed.status },
      );
    }

    const token = parsed.data.token;
    const consumed = await consumeMagicLink(token);
    if (!consumed) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
            message: "登录链接无效或已过期",
          },
        },
        { status: 400 },
      );
    }

    const user = await findOrCreateUserByEmail({
      email: consumed.email,
      displayName: consumed.displayName,
    });

    let sessionToken: string;
    try {
      sessionToken = createSessionToken(user);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
            message: "服务端未配置 AUTH_SECRET",
          },
        },
        { status: 500 },
      );
    }

    const expires = new Date(
      Date.now() + SESSION_MAX_AGE_SEC * 1000,
    ).toISOString();
    const authSession: AuthJsSession = {
      user: userToSessionUser(user),
      expires,
    };
    const session = toAppSession(authSession);

    const res = NextResponse.json({
      session,
      user,
      callbackUrl: consumed.callbackUrl,
    });
    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_LOGIN_FAILED,
          message: "登录失败，请稍后重试",
        },
      },
      { status: 500 },
    );
  }
}

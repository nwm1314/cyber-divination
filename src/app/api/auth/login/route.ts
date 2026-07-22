import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import {
  findOrCreateUserByEmail,
  sanitizeDisplayName,
} from "@/lib/auth/users";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { toAppSession, userToSessionUser } from "@/lib/auth/types";
import type { AuthJsSession } from "@/lib/auth/types";
import { allowDevCredentialsLogin } from "@/lib/auth/magic-link";
import {
  parseJsonBody,
  assertSameOrigin,
  checkRateLimit,
  clientKeyFromRequest,
  rateLimitResponseHeaders,
} from "@/lib/api";
import { loginBodySchema } from "@/lib/contracts";

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

    if (!allowDevCredentialsLogin()) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
            message: "生产环境请使用邮箱登录链接（Magic Link）",
          },
        },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBody(request, loginBodySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_LOGIN_FAILED,
            message:
              parsed.status === 413
                ? parsed.message
                : parsed.message.includes("email") ||
                    parsed.message.includes("邮箱")
                  ? "请输入有效邮箱"
                  : parsed.message,
          },
        },
        { status: parsed.status },
      );
    }

    const email = parsed.data.email;
    const displayName = sanitizeDisplayName(parsed.data.displayName, email);
    const user = await findOrCreateUserByEmail({ email, displayName });

    let token: string;
    try {
      token = createSessionToken(user);
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

    const res = NextResponse.json({ session, user });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
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

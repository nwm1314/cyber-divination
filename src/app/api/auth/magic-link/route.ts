import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { sanitizeDisplayName } from "@/lib/auth/users";
import { createMagicLink } from "@/lib/auth/magic-link";
import {
  parseJsonBody,
  assertSameOrigin,
  checkRateLimit,
  clientKeyFromRequest,
  rateLimitResponseHeaders,
} from "@/lib/api";
import { magicLinkBodySchema } from "@/lib/contracts";

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

    const parsed = await parseJsonBody(request, magicLinkBodySchema);
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
    const callbackUrl = parsed.data.callbackUrl ?? "/";

    const result = await createMagicLink({
      email,
      displayName,
      callbackUrl,
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      expiresAt: result.expiresAt,
      emailed: result.emailed,
      ...(result.devLink ? { devLink: result.devLink } : {}),
      message: result.emailed
        ? "登录链接已发送，请查收邮件"
        : result.devLink
          ? "已生成登录链接（开发环境可直接使用 devLink）"
          : "若该邮箱可接收邮件，登录链接将在稍后送达",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_LOGIN_FAILED,
          message: "发送登录链接失败，请稍后重试",
        },
      },
      { status: 500 },
    );
  }
}

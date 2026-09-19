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
  checkRateLimitOrRespond,
  isRateLimitResponse,
  clientKeyFromRequest,
  rateLimitResponseHeaders,
} from "@/lib/api";
import { deleteConfirmSchema } from "@/lib/contracts";

/**
 * 删除账号的准入判定：同源 → 已登录 → 近期重新登录过。
 *
 * 抽成函数是为了在限流后端不可用时也能问一次同样的问题 —— 鉴权答案必须优先于
 * 基础设施状态，否则匿名请求会拿到 5xx 而不是它本该得到的 401/403。
 */
function accessGate(request: NextRequest): {
  rejection: NextResponse | null;
  userId: string;
} {
  const originErr = assertSameOrigin(request);
  if (originErr) {
    return {
      rejection: NextResponse.json(
        { error: { code: ErrorCode.AUTH_FORBIDDEN, message: originErr } },
        { status: 403 },
      ),
      userId: "",
    };
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);
  const session = sessionFromToken(token);

  if (!session.authenticated || !session.userId || !payload) {
    return {
      rejection: NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_REQUIRED,
            message: "请先登录后再删除账号",
          },
        },
        { status: 401 },
      ),
      userId: "",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof payload.iat !== "number" ||
    now - payload.iat > SESSION_REAUTH_MAX_AGE_SEC
  ) {
    return {
      rejection: NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_FORBIDDEN,
            message: "删除账号前请重新登录以确认身份",
          },
        },
        { status: 403 },
      ),
      userId: "",
    };
  }

  return { rejection: null, userId: session.userId };
}

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request.headers);
  const rl = await checkRateLimitOrRespond(
    "account",
    clientKey,
    () => accessGate(request).rejection,
    "api.account.delete",
  );
  if (isRateLimitResponse(rl)) return rl;
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

  const gate = accessGate(request);
  if (gate.rejection) return gate.rejection;

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

  const user = await getUserById(gate.userId);
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
    const result = await deleteAccount(gate.userId);
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

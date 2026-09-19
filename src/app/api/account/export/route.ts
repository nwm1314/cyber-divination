import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { assertSameOrigin } from "@/lib/api";
import { ErrorCode } from "@/lib/types";
import {
  SESSION_COOKIE_NAME,
  SESSION_REAUTH_MAX_AGE_SEC,
  sessionFromToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { buildAccountExport } from "@/lib/auth/account";
import { getUserById } from "@/lib/auth/users";

/**
 * POST /api/account/export — 导出本人云端数据（GDPR 可携带权）
 *
 * 修复（P2 A8）：此前为 `GET`，且**无 Origin 校验、无近期认证要求**。
 * 风险：跨站 `<img src>` / 顶层导航即可触发导出（浏览器会带上 SameSite=Lax
 * 的 cookie 于顶层 GET 导航），使攻击者能把用户全量命盘数据引导到
 * 可被观测的响应中；同时长寿命会话一旦泄露即可静默拖走全部数据。
 *
 * 现改为与 POST /api/account/delete 一致的三重防护：
 * 1. 仅接受 POST（拒绝简单 GET 导航/图片标签触发）
 * 2. assertSameOrigin —— 拒绝跨站写请求
 * 3. 要求近期认证（iat 距今 ≤ SESSION_REAUTH_MAX_AGE_SEC）
 *
 * 前端调用方见 src/components/account/AccountPanel.tsx。
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "crud", "api.account.export");
  if (limited) return limited;

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
  const session = sessionFromToken(token);
  const payload = verifySessionToken(token);

  if (!session.authenticated || !session.userId || !payload) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: "请先登录后再导出云端数据",
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
          message: "导出数据前请重新登录以确认身份",
        },
      },
      { status: 403 },
    );
  }

  const user = await getUserById(session.userId);
  if (!user) {
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

  const bundle = await buildAccountExport(session.userId);
  if (!bundle) {
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

  return NextResponse.json(bundle, {
    headers: {
      "Content-Disposition": `attachment; filename="cyber-bazi-export-${session.userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET 显式拒绝：保留该导出方法可让调用方收到清晰的 405，
 * 而不是落回 Next.js 的通用 404（后者会掩盖"接口存在但已改为 POST"）。
 */
export function GET() {
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.AUTH_FORBIDDEN,
        message: "导出接口已改为 POST，请通过「账号」页操作",
      },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}

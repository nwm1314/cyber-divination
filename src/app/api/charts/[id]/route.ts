import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  deleteCloudChart,
  getCloudChart,
} from "@/lib/storage/cloud-store";
import { assertSameOrigin } from "@/lib/api";

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.AUTH_REQUIRED,
        message: "请先登录后再访问云端档案",
      },
    },
    { status: 401 },
  );
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/charts/[id] — 本人档案详情 */
export async function GET(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "缺少档案 id",
        },
      },
      { status: 400 },
    );
  }

  const record = await getCloudChart(session.userId, id);
  if (!record) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "档案不存在或无权访问",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ record });
}

/** DELETE /api/charts/[id] — 删除本人档案 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "缺少档案 id",
        },
      },
      { status: 400 },
    );
  }

  const deleted = await deleteCloudChart(session.userId, id);
  if (!deleted) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "档案不存在或无权访问",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}

import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  deleteCloudZiwei,
  getCloudZiwei,
} from "@/lib/storage/cloud-ziwei-store";
import { assertSameOrigin } from "@/lib/api";

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.AUTH_REQUIRED,
        message: "请先登录后再访问云端紫微档案",
      },
    },
    { status: 401 },
  );
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/ziwei-charts/[id] */
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

  const record = await getCloudZiwei(session.userId, id);
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

/** DELETE /api/ziwei-charts/[id] */
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

  const deleted = await deleteCloudZiwei(session.userId, id);
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

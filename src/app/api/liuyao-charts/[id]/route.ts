import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  deleteCloudLiuyao,
  getCloudLiuyao,
} from "@/lib/storage/cloud-liuyao-store";
import { assertSameOrigin } from "@/lib/api";

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.AUTH_REQUIRED,
        message: "请先登录后再访问云端问卦",
      },
    },
    { status: 401 },
  );
}

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/liuyao-charts/[id] */
export async function GET(request: NextRequest, ctx: Ctx) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }
  const { id } = await ctx.params;
  const record = await getCloudLiuyao(session.userId, id);
  if (!record) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "问卦不存在",
        },
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ record });
}

/** DELETE /api/liuyao-charts/[id] */
export async function DELETE(request: NextRequest, ctx: Ctx) {
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
  const { id } = await ctx.params;
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
  const deleted = await deleteCloudLiuyao(session.userId, id);
  if (!deleted) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "问卦不存在",
        },
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ deleted: true });
}

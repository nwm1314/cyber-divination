import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  deleteCloudPerson,
  getCloudPerson,
  upsertCloudPerson,
} from "@/lib/storage/cloud-person-store";
import { assertSameOrigin, parseJsonBody } from "@/lib/api";
import { personInputSchema } from "@/lib/contracts";

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.AUTH_REQUIRED,
        message: "请先登录后再访问人物档案",
      },
    },
    { status: 401 },
  );
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/people/[id] */
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
          message: "缺少人物 id",
        },
      },
      { status: 400 },
    );
  }

  const person = await getCloudPerson(session.userId, id);
  if (!person) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "人物不存在或无权访问",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ person });
}

/** PUT /api/people/[id] — 全量更新（含关联 chartIds / ziweiIds） */
export async function PUT(request: NextRequest, context: RouteContext) {
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
          message: "缺少人物 id",
        },
      },
      { status: 400 },
    );
  }

  const parsed = await parseJsonBody(request, personInputSchema);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.INVALID_PROFILE,
          message: parsed.message,
        },
      },
      { status: parsed.status },
    );
  }

  try {
    const person = await upsertCloudPerson(session.userId, {
      ...parsed.data,
      id,
      name: parsed.data.name.trim(),
    });
    return NextResponse.json({ person });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.INVALID_PROFILE,
          message,
        },
      },
      { status: 400 },
    );
  }
}

/** DELETE /api/people/[id] */
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
          message: "缺少人物 id",
        },
      },
      { status: 400 },
    );
  }

  const deleted = await deleteCloudPerson(session.userId, id);
  if (!deleted) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "人物不存在或无权访问",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}

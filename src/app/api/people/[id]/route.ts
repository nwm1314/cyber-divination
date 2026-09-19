import { NextRequest, NextResponse } from "next/server";
import { MESSAGES } from "@/content/zh";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  deleteCloudPerson,
  getCloudPerson,
  upsertCloudPerson,
  personBelongsToUser,
} from "@/lib/storage/cloud-person-store";
import { assertSameOrigin, parseJsonBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { logApi } from "@/lib/api/logger";
import { toSafeErrorMessage } from "@/lib/api/safe-error";
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
  const limited = await enforceRateLimit(request, "crud", "api.people.get");
  if (limited) return limited;
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
  const limited = await enforceRateLimit(request, "crud", "api.people.put");
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

  // 越权防护（IDOR）：PUT 语义是「更新已存在的人物」，
  // 因此 id 必须已属于当前会话用户。此前直接 upsertCloudPerson(session.userId, {id})，
  // 导致任意登录用户可用他人 id 创建/占用同 id 记录（资源命名空间污染）。
  // 返回「不存在或无权访问」而非「无权」：不泄露该 id 是否真实存在。
  if (!(await personBelongsToUser(session.userId, id))) {
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
    const message = toSafeErrorMessage(e, MESSAGES.saveFailed, (original) =>
      logApi("error", "people.update.error", { route: "api.people.update", requestId: crypto.randomUUID(), message: original }),
    );
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
  const limited = await enforceRateLimit(request, "crud", "api.people.delete");
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

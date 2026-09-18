import { NextRequest, NextResponse } from "next/server";
import { MESSAGES } from "@/content/zh";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudPeople,
  upsertCloudPerson,
} from "@/lib/storage/cloud-person-store";
import type { PersonInput } from "@/lib/types/user";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
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

/** GET /api/people — 本人人物列表 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, "crud", "api.people.list");
  if (limited) return limited;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }

  const items = await listCloudPeople(session.userId);
  return NextResponse.json({ items });
}

/** POST /api/people — 创建/更新人物（userId 仅来自 session） */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "crud", "api.people.create");
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

  // 服务端权威：强制 userId = session
  const body: PersonInput = {
    ...parsed.data,
    userId: session.userId,
  };

  try {
    const person = await upsertCloudPerson(session.userId, body);
    return NextResponse.json({ person });
  } catch (e) {
    const message = toSafeErrorMessage(
      e,
      MESSAGES.saveFailed,
      (original) =>
        logApi("error", "people.create.error", {
          requestId: crypto.randomUUID(),
          route: "api.people.create",
          message: original,
        }),
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

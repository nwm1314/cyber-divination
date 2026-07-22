import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudLiuyao,
  upsertCloudLiuyao,
} from "@/lib/storage/cloud-liuyao-store";
import type { CloudLiuyaoUpsertBody } from "@/lib/storage/cloud-liuyao-types";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
import { cloudLiuyaoUpsertSchema } from "@/lib/contracts";

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

/** GET /api/liuyao-charts — 本人云端六爻列表 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }
  const items = await listCloudLiuyao(session.userId);
  return NextResponse.json({ items });
}

/** POST /api/liuyao-charts — 保存问卦（userId 仅来自 session） */
export async function POST(request: NextRequest) {
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

  const parsed = await parseJsonBody(request, cloudLiuyaoUpsertSchema);
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

  // 服务端权威：chart.userId 由 store 按 session 写入
  const body: CloudLiuyaoUpsertBody = {
    chart: {
      ...parsed.data.chart,
      id: parsed.data.chart.id,
      question: parsed.data.chart.question,
      userId: session.userId,
    } as CloudLiuyaoUpsertBody["chart"],
  };

  try {
    const record = await upsertCloudLiuyao(session.userId, body);
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.INVALID_PROFILE,
          message: err instanceof Error ? err.message : "保存失败",
        },
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudZiwei,
  upsertCloudZiwei,
} from "@/lib/storage/cloud-ziwei-store";
import type { CloudZiweiUpsertBody } from "@/lib/storage/cloud-ziwei-types";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
import { cloudZiweiUpsertSchema } from "@/lib/contracts";

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

/** GET /api/ziwei-charts — 本人紫微列表 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }

  const items = await listCloudZiwei(session.userId);
  return NextResponse.json({ items });
}

/** POST /api/ziwei-charts — 保存/覆盖紫微盘（userId 仅来自 session） */
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

  const parsed = await parseJsonBody(request, cloudZiweiUpsertSchema);
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

  // 服务端权威：剥离客户端伪造的 chart.userId，以 session 归属
  const { userId: _forged, ...chartRest } = parsed.data.chart as {
    userId?: string | null;
  } & typeof parsed.data.chart;
  void _forged;

  const body: CloudZiweiUpsertBody = {
    chart: {
      ...chartRest,
      id: parsed.data.chart.id,
    } as CloudZiweiUpsertBody["chart"],
    solarDate: parsed.data.solarDate,
  };

  try {
    const record = await upsertCloudZiwei(session.userId, body);
    return NextResponse.json({ record });
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

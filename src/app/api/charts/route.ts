import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudCharts,
  upsertCloudChart,
} from "@/lib/storage/cloud-store";
import type { CloudChartUpsertBody } from "@/lib/storage/cloud-types";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
import { cloudChartUpsertSchema } from "@/lib/contracts";

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

/** GET /api/charts — 本人云端档案列表 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return unauthorized();
  }

  const items = await listCloudCharts(session.userId);
  return NextResponse.json({ items });
}

/** POST /api/charts — 保存/覆盖本人档案（userId 仅来自 session） */
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

  const parsed = await parseJsonBody(request, cloudChartUpsertSchema);
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

  // 服务端权威：强制 profile.userId = session；忽略客户端伪造
  const body: CloudChartUpsertBody = {
    profile: {
      ...parsed.data.profile,
      id: parsed.data.profile.id,
      userId: session.userId,
    } as CloudChartUpsertBody["profile"],
    chart: {
      ...parsed.data.chart,
      profileId: parsed.data.profile.id,
    } as CloudChartUpsertBody["chart"],
    report: parsed.data.report as CloudChartUpsertBody["report"],
    calibration: parsed.data.calibration as CloudChartUpsertBody["calibration"],
  };

  try {
    const record = await upsertCloudChart(session.userId, body);
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

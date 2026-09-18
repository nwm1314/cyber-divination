import { NextRequest, NextResponse } from "next/server";
import { MESSAGES } from "@/content/zh";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudCharts,
  upsertCloudChart,
} from "@/lib/storage/cloud-store";
import type { CloudChartUpsertBody } from "@/lib/storage/cloud-types";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { logApi } from "@/lib/api/logger";
import { toSafeErrorMessage } from "@/lib/api/safe-error";
import { cloudChartUpsertSchema } from "@/lib/contracts";
import { computeAuthoritativeChart } from "@/lib/bazi";
import type { BirthProfile } from "@/lib/types";

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
  const limited = await enforceRateLimit(request, "crud", "api.charts.list");
  if (limited) return limited;
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
  const limited = await enforceRateLimit(request, "crud", "api.charts.create");
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

  const profile = {
    ...parsed.data.profile,
    id: parsed.data.profile.id,
    userId: session.userId,
  } as BirthProfile;
  let authoritativeChart: ReturnType<typeof computeAuthoritativeChart>;
  try {
    authoritativeChart = computeAuthoritativeChart(profile);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.INVALID_PROFILE,
          message: toSafeErrorMessage(error, "出生资料无法排盘，请检查出生日期与时辰"),
        },
      },
      { status: 400 },
    );
  }

  // 服务端权威：强制 profile.userId = session；忽略客户端伪造
  const body: CloudChartUpsertBody = {
    profile: {
      ...profile,
    },
    chart: authoritativeChart,
    report: parsed.data.report as CloudChartUpsertBody["report"],
    calibration: parsed.data.calibration as CloudChartUpsertBody["calibration"],
  };

  try {
    const record = await upsertCloudChart(session.userId, body);
    return NextResponse.json({ record });
  } catch (e) {
    const message = toSafeErrorMessage(e, MESSAGES.saveFailedRetry, (original) =>
      logApi("error", "charts.save.error", { route: "api.charts.save", requestId: crypto.randomUUID(), message: original }),
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

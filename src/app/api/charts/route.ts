import { NextRequest, NextResponse } from "next/server";
import { MESSAGES } from "@/content/zh";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  listCloudCharts,
  upsertCloudChart,
} from "@/lib/storage/cloud-store";
import type { CloudChartUpsertBody } from "@/lib/storage/cloud-types";
import { parseJsonBody, assertSameOrigin, versionConflictResponse } from "@/lib/api";
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

/**
 * 云端档案面的准入判定（读：需登录；写：还需同源）。
 *
 * 抽出来是因为限流后端不可用时也要问一次同样的问题 —— 鉴权答案必须优先于
 * 基础设施状态，否则匿名请求会拿到 5xx 而不是它本该得到的 401/403。
 */
function readAccess(request: NextRequest) {
  const session = sessionFromToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!session.authenticated || !session.userId) {
    return { rejection: unauthorized(), userId: "" };
  }
  return { rejection: null as NextResponse | null, userId: session.userId };
}

function writeAccess(request: NextRequest) {
  const originErr = assertSameOrigin(request);
  if (originErr) {
    return {
      rejection: NextResponse.json(
        { error: { code: ErrorCode.AUTH_FORBIDDEN, message: originErr } },
        { status: 403 },
      ),
      userId: "",
    };
  }
  return readAccess(request);
}

/** GET /api/charts — 本人云端档案列表 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(
    request,
    "crud",
    "api.charts.list",
    () => readAccess(request).rejection,
  );
  if (limited) return limited;
  const access = readAccess(request);
  if (access.rejection) return access.rejection;

  const items = await listCloudCharts(access.userId);
  return NextResponse.json({ items });
}

/** POST /api/charts — 保存/覆盖本人档案（userId 仅来自 session） */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(
    request,
    "crud",
    "api.charts.create",
    () => writeAccess(request).rejection,
  );
  if (limited) return limited;
  const access = writeAccess(request);
  if (access.rejection) return access.rejection;

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
    userId: access.userId,
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
    const record = await upsertCloudChart(access.userId, body, {
      expectedVersion: parsed.data.expectedVersion,
    });
    return NextResponse.json({ record });
  } catch (e) {
    const conflict = versionConflictResponse(e);
    if (conflict) return conflict;
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

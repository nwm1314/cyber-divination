import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type {
  LiuyaoReadingReport,
  LiuyaoShareSummary,
  ReadingReport,
  ShareKind,
  ShareSnapshot,
  ZiweiReadingReport,
  ZiweiShareSummary,
} from "@/lib/types";
import { ErrorCode } from "@/lib/types";
import {
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
  saveShareSnapshot,
} from "@/lib/share";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  assertSameOrigin,
  checkBodySize,
  checkRateLimit,
  clientKeyFromRequest,
  logApi,
  rateLimitResponseHeaders,
  requestIdHeader,
  resolveRequestId,
  validateChartPayload,
  validateLiuyaoChartPayload,
  validateZiweiChartPayload,
} from "@/lib/api";

function maskName(name: string): string {
  const t = name.trim();
  if (!t) return "命盘分享";
  if (t.length === 1) return "*";
  if (t.length === 2) return t[0] + "*";
  return t[0] + "*".repeat(Math.min(t.length - 2, 4)) + t[t.length - 1];
}

function extractAdvice(
  sections: { key: string; body?: string }[] | undefined,
  kind: "bazi" | "ziwei" | "liuyao" = "bazi",
): string {
  return extractShareMottoFromSections(sections, {
    maxLen: 60,
    fallback: MOTTO_FALLBACK[kind],
    preferKeys:
      kind === "liuyao" ? ["advice", "judgment"] : ["advice"],
  });
}

function buildZiweiSummary(chart: {
  mingGong: string;
  shenGong: string;
  wuxingJu?: string;
  mingZhu?: string;
  shenZhu?: string;
  majorStars?: Record<string, string[]>;
  palaces?: { name: string; stars: { name: string; category?: string }[] }[];
}): ZiweiShareSummary {
  const fromMajor = chart.majorStars?.["命宫"] ?? chart.majorStars?.[chart.mingGong];
  let mingStars = fromMajor?.slice(0, 6);
  if (!mingStars?.length && Array.isArray(chart.palaces)) {
    const ming = chart.palaces.find((p) => p.name === "命宫");
    mingStars = ming?.stars
      ?.filter((s) => !s.category || s.category === "major")
      .map((s) => s.name)
      .slice(0, 6);
  }
  return {
    mingGong: String(chart.mingGong).slice(0, 16),
    shenGong: String(chart.shenGong).slice(0, 16),
    wuxingJu: chart.wuxingJu?.slice(0, 16),
    mingZhu: chart.mingZhu?.slice(0, 16),
    shenZhu: chart.shenZhu?.slice(0, 16),
    mingStars,
  };
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const requestId = resolveRequestId(request.headers);
  const clientKey = clientKeyFromRequest(request.headers);
  const rid = requestIdHeader(requestId);

  try {
    const originErr = assertSameOrigin(request);
    if (originErr) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_FORBIDDEN,
            message: originErr,
          },
        },
        { status: 403, headers: rid },
      );
    }

    const tokenCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionFromToken(tokenCookie);
    if (!session.authenticated || !session.userId) {
      logApi("warn", "api.share.auth_required", {
        requestId,
        route: "/api/share",
        method: "POST",
        status: 401,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.AUTH_REQUIRED,
      });
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.AUTH_REQUIRED,
            message: "请登录后再生成分享链接（游客可导出图片/PDF）",
          },
        },
        { status: 401, headers: rid },
      );
    }

    const rl = await checkRateLimit("share", clientKey);
    if (!rl.allowed) {
      logApi("warn", "api.rate_limited", {
        requestId,
        route: "/api/share",
        method: "POST",
        status: 429,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.INVALID_PROFILE,
      });
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.INVALID_PROFILE,
            message: "请求过于频繁，请稍后再试",
          },
        },
        {
          status: 429,
          headers: { ...rid, ...rateLimitResponseHeaders(rl) },
        },
      );
    }

    const raw = await request.text();
    const sizeErr = checkBodySize(raw);
    if (sizeErr) {
      logApi("warn", "api.share.reject", {
        requestId,
        route: "/api/share",
        status: 413,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.INVALID_PROFILE,
        message: sizeErr,
      });
      return NextResponse.json(
        { error: { code: ErrorCode.INVALID_PROFILE, message: sizeErr } },
        { status: 413, headers: rid },
      );
    }

    let body: {
      kind?: ShareKind;
      chart?: unknown;
      report?:
        | Partial<ReadingReport>
        | Partial<ZiweiReadingReport>
        | Partial<LiuyaoReadingReport>;
      chartName?: string;
      maskName?: boolean;
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.INVALID_PROFILE,
            message: "JSON 解析失败",
          },
        },
        { status: 400, headers: rid },
      );
    }

    const reportKind = (body.report as { kind?: string } | undefined)?.kind;
    const kind: ShareKind =
      body.kind === "liuyao" || reportKind === "liuyao"
        ? "liuyao"
        : body.kind === "ziwei" || reportKind === "ziwei"
          ? "ziwei"
          : "bazi";

    if (!body.report?.sections || !Array.isArray(body.report.sections)) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.INVALID_PROFILE,
            message: "缺少有效报告数据",
          },
        },
        { status: 400, headers: rid },
      );
    }

    const token = randomUUID();
    const advice = extractAdvice(body.report.sections, kind).slice(0, 120);
    const defaultName =
      kind === "ziwei" ? "紫微分享" : kind === "liuyao" ? "六爻分享" : "命盘分享";
    const rawName = body.chartName || defaultName;
    const doMask = body.maskName !== false;
    const chartName = doMask ? maskName(rawName) : rawName.slice(0, 32);
    const disclaimer =
      body.report.disclaimer?.slice(0, 500) ||
      "命理分析仅供参考，人生在于自身的努力和选择。";
    const createdAt = new Date().toISOString();

    let snapshot: ShareSnapshot;

    if (kind === "ziwei") {
      const v = validateZiweiChartPayload(body.chart);
      if (!v.ok) {
        return NextResponse.json(
          { error: { code: ErrorCode.INVALID_PROFILE, message: v.message } },
          { status: 400, headers: rid },
        );
      }
      snapshot = {
        token,
        kind: "ziwei",
        chartId: v.chart.id,
        chartName,
        nameMasked: doMask,
        ziwei: buildZiweiSummary(v.chart),
        advice,
        disclaimer,
        createdAt,
      };
    } else if (kind === "liuyao") {
      const v = validateLiuyaoChartPayload(body.chart);
      if (!v.ok) {
        return NextResponse.json(
          { error: { code: ErrorCode.INVALID_PROFILE, message: v.message } },
          { status: 400, headers: rid },
        );
      }
      const q = String(v.chart.question || "").slice(0, 80);
      const liuyao: LiuyaoShareSummary = {
        question: doMask && q.length > 2 ? q[0] + "***" : q || "一事一问",
        method: String(v.chart.method),
        benGuaName: v.chart.benGua.name,
        bianGuaName: v.chart.bianGua?.name,
        shiYao: v.chart.shiYao,
        yingYao: v.chart.yingYao,
        yongShen: v.chart.yongShen,
      };
      snapshot = {
        token,
        kind: "liuyao",
        chartId: v.chart.id,
        chartName,
        nameMasked: doMask,
        liuyao,
        advice,
        disclaimer,
        createdAt,
      };
    } else {
      const v = validateChartPayload(body.chart);
      if (!v.ok) {
        return NextResponse.json(
          { error: { code: ErrorCode.INVALID_PROFILE, message: v.message } },
          { status: 400, headers: rid },
        );
      }
      snapshot = {
        token,
        kind: "bazi",
        chartId: v.chart.profileId,
        chartName,
        nameMasked: doMask,
        pillars: v.chart.pillars,
        dayMaster: v.chart.dayMaster,
        advice,
        disclaimer,
        createdAt,
      };
    }

    await saveShareSnapshot(snapshot);

    const path =
      kind === "ziwei"
        ? `/share/ziwei/${token}`
        : kind === "liuyao"
          ? `/share/liuyao/${token}`
          : `/share/${token}`;
    const url = `${request.nextUrl.origin}${path}`;
    const durationMs = Date.now() - started;

    logApi("info", "api.share.ok", {
      requestId,
      route: "/api/share",
      method: "POST",
      status: 200,
      durationMs,
      clientKey,
      chartId: snapshot.chartId,
      kind,
      tokenPrefix: token.slice(0, 8),
    });

    return NextResponse.json(
      { data: { token, url, kind } },
      {
        status: 200,
        headers: {
          ...rid,
          ...rateLimitResponseHeaders(rl),
        },
      },
    );
  } catch (err) {
    const durationMs = Date.now() - started;
    logApi("error", "api.share.error", {
      requestId,
      route: "/api/share",
      method: "POST",
      status: 500,
      durationMs,
      clientKey,
      errorCode: ErrorCode.CHART_COMPUTE_FAILED,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.CHART_COMPUTE_FAILED,
          message: "分享服务异常",
        },
      },
      { status: 500, headers: rid },
    );
  }
}

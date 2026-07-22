import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { llmReading } from "@/lib/reading/llm/llm";
import {
  assertSameOrigin,
  checkBodySize,
  checkRateLimit,
  clientKeyFromRequest,
  logApi,
  parseViewMode,
  rateLimitResponseHeaders,
  requestIdHeader,
  resolveRequestId,
  validateChartPayload,
} from "@/lib/api";

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

    const rl = await checkRateLimit("reading", clientKey);
    if (!rl.allowed) {
      logApi("warn", "api.rate_limited", {
        requestId,
        route: "/api/reading",
        method: "POST",
        status: 429,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.LLM_UNAVAILABLE,
      });
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.LLM_UNAVAILABLE,
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
      logApi("warn", "api.reading.reject", {
        requestId,
        route: "/api/reading",
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

    let body: { chart?: unknown; viewMode?: unknown; gender?: unknown };
    try {
      body = JSON.parse(raw) as {
        chart?: unknown;
        viewMode?: unknown;
        gender?: unknown;
      };
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

    const v = validateChartPayload(body.chart);
    if (!v.ok) {
      return NextResponse.json(
        { error: { code: ErrorCode.INVALID_PROFILE, message: v.message } },
        { status: 400, headers: rid },
      );
    }

    const gender =
      body.gender === "male" || body.gender === "female"
        ? body.gender
        : undefined;

    const report = await llmReading(v.chart, {
      viewMode: parseViewMode(body.viewMode),
      gender,
      requestId,
    });
    const durationMs = Date.now() - started;
    const { meta, ...data } = report;

    logApi("info", "api.reading.ok", {
      requestId,
      route: "/api/reading",
      method: "POST",
      status: 200,
      durationMs,
      clientKey,
      art: "bazi",
      model: meta?.model ?? null,
      fallback: Boolean(report.fallback),
      fallbackReason: report.fallbackReason,
      errorCode: meta?.errorCode,
      promptTokens: meta?.usage.promptTokens ?? null,
      completionTokens: meta?.usage.completionTokens ?? null,
      totalTokens: meta?.usage.totalTokens ?? null,
      chartId: v.chart.profileId,
      mode: report.mode,
    });

    return NextResponse.json(
      { data },
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
    logApi("error", "api.reading.error", {
      requestId,
      route: "/api/reading",
      method: "POST",
      status: 500,
      durationMs,
      clientKey,
      errorCode: ErrorCode.LLM_UNAVAILABLE,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.LLM_UNAVAILABLE,
          message: "解读服务异常",
        },
      },
      { status: 500, headers: rid },
    );
  }
}

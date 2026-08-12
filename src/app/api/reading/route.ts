import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { llmReading } from "@/lib/reading/llm/llm";
import {
  assertSameOrigin,
  checkRateLimit,
  clientKeyFromRequest,
  logApi,
  parseJsonBody,
  rateLimitResponseHeaders,
  requestIdHeader,
  resolveRequestId,
  stripAuthorityInput,
  validateAuthoritativeBaziRequest,
} from "@/lib/api";
import { baziReadingRequestSchema } from "@/lib/contracts";

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

    const parsed = await parseJsonBody(request, baziReadingRequestSchema);
    if (!parsed.ok) {
      logApi("warn", "api.reading.reject", {
        requestId,
        route: "/api/reading",
        status: parsed.status,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.INVALID_PROFILE,
        message: parsed.message,
      });
      return NextResponse.json(
        { error: { code: ErrorCode.INVALID_PROFILE, message: parsed.message } },
        { status: parsed.status, headers: rid },
      );
    }

    const resolved = validateAuthoritativeBaziRequest(parsed.data);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          error: {
            code: ErrorCode.INVALID_PROFILE,
            message: resolved.message,
          },
        },
        { status: 400, headers: rid },
      );
    }

    const chart = stripAuthorityInput(resolved.data.chart);
    const report = await llmReading(chart, {
      viewMode: resolved.data.viewMode,
      gender: resolved.data.profile.gender,
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
      chartId: chart.profileId,
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

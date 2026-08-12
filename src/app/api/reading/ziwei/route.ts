import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorCode } from "@/lib/types";
import { llmZiweiReading, renderZiweiTemplateReading } from "@/lib/reading/ziwei";
import {
  assertSameOrigin,
  checkRateLimit,
  clientKeyFromRequest,
  logApi,
  parseViewMode,
  parseJsonBody,
  rateLimitResponseHeaders,
  requestIdHeader,
  resolveRequestId,
  validateZiweiChartPayload,
} from "@/lib/api";

const ziweiReadingBodySchema = z.object({
  chart: z.unknown(),
  viewMode: z.enum(["plain", "pro"]).optional(),
  gender: z.enum(["male", "female"]).optional(),
  mode: z.enum(["template", "llm"]).optional(),
});

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
        route: "/api/reading/ziwei",
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

    const parsed = await parseJsonBody(request, ziweiReadingBodySchema);
    if (!parsed.ok) {
      const message = parsed.message;
      logApi("warn", "api.reading.ziwei.reject", {
        requestId,
        route: "/api/reading/ziwei",
        status: parsed.status,
        durationMs: Date.now() - started,
        clientKey,
        errorCode: ErrorCode.INVALID_PROFILE,
        message,
      });
      return NextResponse.json(
        { error: { code: ErrorCode.INVALID_PROFILE, message } },
        { status: parsed.status, headers: rid },
      );
    }

    const body = parsed.data;
    const v = validateZiweiChartPayload(body.chart);
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
    const viewMode = parseViewMode(body.viewMode);
    const mode = body.mode === "template" ? "template" : "llm";

    const report =
      mode === "template"
        ? renderZiweiTemplateReading(v.chart, {
            viewMode,
            gender,
            chartId: v.chart.id,
          })
        : await llmZiweiReading(v.chart, {
            viewMode,
            gender,
            chartId: v.chart.id,
            requestId,
          });

    const durationMs = Date.now() - started;
    const meta =
      "meta" in report
        ? (
            report as {
              meta?: {
                model?: string | null;
                usage?: {
                  promptTokens?: number | null;
                  completionTokens?: number | null;
                  totalTokens?: number | null;
                };
                errorCode?: string;
              };
            }
          ).meta
        : undefined;
    const data = { ...report } as Record<string, unknown>;
    delete data.meta;
    logApi("info", "api.reading.ziwei.ok", {
      requestId,
      route: "/api/reading/ziwei",
      method: "POST",
      status: 200,
      durationMs,
      clientKey,
      art: "ziwei",
      model: meta?.model ?? null,
      fallback: Boolean(report.fallback),
      fallbackReason: report.fallbackReason,
      errorCode: meta?.errorCode,
      promptTokens: meta?.usage?.promptTokens ?? null,
      completionTokens: meta?.usage?.completionTokens ?? null,
      totalTokens: meta?.usage?.totalTokens ?? null,
      chartId: v.chart.id,
      mode: report.mode,
      kind: "ziwei",
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
    logApi("error", "api.reading.ziwei.error", {
      requestId,
      route: "/api/reading/ziwei",
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

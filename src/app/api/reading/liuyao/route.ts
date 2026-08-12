import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ErrorCode } from "@/lib/types";
import {
  llmLiuyaoReading,
  renderLiuyaoTemplateReading,
} from "@/lib/reading/liuyao";
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
  validateLiuyaoChartPayload,
} from "@/lib/api";

const liuyaoReadingBodySchema = z.object({
  chart: z.unknown(),
  viewMode: z.enum(["plain", "pro"]).optional(),
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
        route: "/api/reading/liuyao",
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

    const parsed = await parseJsonBody(request, liuyaoReadingBodySchema);
    if (!parsed.ok) {
      const message = parsed.message;
      logApi("warn", "api.reading.liuyao.reject", {
        requestId,
        route: "/api/reading/liuyao",
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
    const v = validateLiuyaoChartPayload(body.chart);
    if (!v.ok) {
      return NextResponse.json(
        { error: { code: ErrorCode.INVALID_PROFILE, message: v.message } },
        { status: 400, headers: rid },
      );
    }

    const viewMode = parseViewMode(body.viewMode);
    const mode = body.mode === "template" ? "template" : "llm";

    const report =
      mode === "template"
        ? renderLiuyaoTemplateReading(v.chart, {
            viewMode,
            chartId: v.chart.id,
          })
        : await llmLiuyaoReading(v.chart, {
            viewMode,
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
    logApi("info", "api.reading.liuyao.ok", {
      requestId,
      route: "/api/reading/liuyao",
      method: "POST",
      status: 200,
      durationMs,
      clientKey,
      art: "liuyao",
      model: meta?.model ?? null,
      fallback: Boolean(report.fallback),
      fallbackReason: report.fallbackReason,
      errorCode: meta?.errorCode,
      promptTokens: meta?.usage?.promptTokens ?? null,
      completionTokens: meta?.usage?.completionTokens ?? null,
      totalTokens: meta?.usage?.totalTokens ?? null,
      chartId: v.chart.id,
      mode: report.mode,
      kind: "liuyao",
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
    logApi("error", "api.reading.liuyao.error", {
      requestId,
      route: "/api/reading/liuyao",
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

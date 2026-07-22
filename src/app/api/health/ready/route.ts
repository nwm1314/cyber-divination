import { NextResponse } from "next/server";
import { runReadinessChecks } from "@/lib/health/readiness";

/**
 * Readiness：依赖（DB / Redis）就绪检查（T302）
 * 失败 503 + details；成功 200 + { status: "ready", checks }
 */
export async function GET() {
  const result = await runReadinessChecks();
  const body = {
    status: result.ready ? ("ready" as const) : ("not_ready" as const),
    checks: result.checks,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: result.ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

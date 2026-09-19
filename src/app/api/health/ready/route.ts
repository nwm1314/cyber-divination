import { NextResponse } from "next/server";
import { runReadinessChecks } from "@/lib/health/readiness";

/**
 * Readiness：依赖（DB / Redis）就绪检查（T302）
 *
 * - 依赖被校验且可用        → 200 { status: "ready", degraded: false }
 * - 依赖被校验但不可用      → 503 { status: "not_ready" }
 * - 依赖未接入（file 驱动）→ 200 { status: "ready", degraded: true,
 *                                degradedChecks: ["db","redis"] }
 *
 * 降级仍返回 200：这类实例正常服务，摘掉会误伤可用性；
 * 监控/巡检须检查 degraded，而不是只看 ready（见 docs/DEPLOY.md 探针说明）。
 */
export async function GET() {
  const result = await runReadinessChecks();
  const body = {
    status: result.ready ? ("ready" as const) : ("not_ready" as const),
    degraded: result.degraded,
    degradedChecks: result.degradedChecks,
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

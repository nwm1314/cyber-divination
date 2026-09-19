import { NextResponse } from "next/server";
import { runReadinessChecks, type CheckResult } from "@/lib/health/readiness";
import { logApi } from "@/lib/api/logger";

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
 *
 * 出口脱敏（§2.6-2）：本端点无需鉴权，而依赖的原始错误文本会带上内部主机名与
 * 用户名（如 `用户 "e2e" Password 认证失败`）。这里只回固定类别文案，原文进
 * 服务端日志。不能靠 toSafeErrorMessage 兜底：那类中文技术文案没有驱动特征词，
 * 会被判成可信业务文案而原样放行。
 */
const PUBLIC_CHECK_MESSAGE: Record<"db" | "redis", string> = {
  db: "数据库依赖检查未通过",
  redis: "Redis 依赖检查未通过",
};

function publicCheck(name: "db" | "redis", check: CheckResult): CheckResult {
  if (check.ok || check.skipped) {
    return { ...check, message: check.ok ? "ok" : "skipped" };
  }
  return { ok: false, message: PUBLIC_CHECK_MESSAGE[name] };
}

export async function GET() {
  const result = await runReadinessChecks();
  if (!result.ready) {
    logApi("error", "health.readiness_failed", {
      requestId: crypto.randomUUID(),
      route: "api.health.ready",
      status: 503,
      errorCode: "READINESS_FAILED",
      checks: result.checks,
    });
  }
  const body = {
    status: result.ready ? ("ready" as const) : ("not_ready" as const),
    degraded: result.degraded,
    degradedChecks: result.degradedChecks,
    checks: {
      db: publicCheck("db", result.checks.db),
      redis: publicCheck("redis", result.checks.redis),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: result.ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

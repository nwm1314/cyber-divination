import { NextResponse } from "next/server";

/**
 * Liveness：进程级存活检查（T302）
 * 不探测 DB/Redis；依赖就绪见 GET /api/health/ready
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "cyber-divination",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

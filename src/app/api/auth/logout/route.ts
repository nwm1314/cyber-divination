import { NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { assertSameOrigin } from "@/lib/api";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { toAppSession } from "@/lib/auth/types";

export async function POST(request: Request) {
  const originErr = assertSameOrigin(request);
  if (originErr) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: originErr,
        },
      },
      { status: 403 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    session: toAppSession(null),
  });
  res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
  return res;
}

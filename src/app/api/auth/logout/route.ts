import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { toAppSession } from "@/lib/auth/types";

export async function POST() {
  const res = NextResponse.json({
    ok: true,
    session: toAppSession(null),
  });
  res.cookies.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
  return res;
}

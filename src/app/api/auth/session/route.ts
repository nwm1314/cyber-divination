import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  sessionFromToken,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  return NextResponse.json({ session });
}

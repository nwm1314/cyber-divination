import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import { buildAccountExport } from "@/lib/auth/account";
import { getUserById } from "@/lib/auth/users";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);

  if (!session.authenticated || !session.userId) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: "请先登录后再导出云端数据",
        },
      },
      { status: 401 },
    );
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_USER_NOT_FOUND,
          message: "账号不存在或已删除",
        },
      },
      { status: 404 },
    );
  }

  const bundle = await buildAccountExport(session.userId);
  if (!bundle) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_USER_NOT_FOUND,
          message: "账号不存在或已删除",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(bundle, {
    headers: {
      "Content-Disposition": `attachment; filename="cyber-bazi-export-${session.userId}.json"`,
    },
  });
}

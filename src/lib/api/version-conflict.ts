import { NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { isVersionConflict } from "@/lib/storage/version-guard";

/**
 * 存储层乐观锁冲突 → HTTP 409（B4）。
 *
 * 冲突消息由服务端自己构造（只含资源类型、id 与两个版本号），不含驱动细节，
 * 因此可直接返回给客户端；非冲突错误返回 null，交回调用方按原路径处理。
 */
export function versionConflictResponse(
  error: unknown,
  extraHeaders?: Record<string, string>,
): NextResponse | null {
  if (!isVersionConflict(error)) return null;
  return NextResponse.json(
    {
      error: {
        code: ErrorCode.STORAGE_VERSION_CONFLICT,
        message: error.message,
        expectedVersion: error.expectedVersion,
        storedVersion: error.storedVersion,
      },
    },
    { status: 409, headers: extraHeaders },
  );
}

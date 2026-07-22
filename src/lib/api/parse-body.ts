import type { z } from "zod";

export const DEFAULT_MAX_BODY_BYTES = 200_000;

export type ParseBodyOk<T> = { ok: true; data: T };
export type ParseBodyErr = {
  ok: false;
  status: number;
  message: string;
};
export type ParseBodyResult<T> = ParseBodyOk<T> | ParseBodyErr;

/**
 * 读取 JSON body：字节上限 → JSON.parse → zod safeParse
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<ParseBodyResult<T>> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, message: "无法读取请求体" };
  }

  // 使用 UTF-8 字节长度（与 Content-Length 更接近）
  const byteLen = typeof Buffer !== "undefined"
    ? Buffer.byteLength(raw, "utf8")
    : new TextEncoder().encode(raw).length;

  if (byteLen > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `请求体过大（>${maxBytes} 字节）`,
    };
  }

  let parsed: unknown;
  try {
    parsed = raw.length === 0 ? {} : JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, message: "JSON 解析失败" };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    const msg = first?.message ?? "请求体校验失败";
    return { ok: false, status: 400, message: path + msg };
  }

  return { ok: true, data: result.data };
}

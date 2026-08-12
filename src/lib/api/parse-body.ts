import type { z } from "zod";

export const DEFAULT_MAX_BODY_BYTES = 200_000;

export type ParseBodyOk<T> = { ok: true; data: T };
export type ParseBodyErr = {
  ok: false;
  status: number;
  message: string;
};
export type ParseBodyResult<T> = ParseBodyOk<T> | ParseBodyErr;

type ReadBodyResult =
  | { ok: true; raw: string }
  | { ok: false; tooLarge: true };

function contentLengthExceedsLimit(
  value: string | null,
  maxBytes: number,
): boolean {
  if (!value || !/^\d+$/.test(value.trim())) return false;

  const normalized = value.trim().replace(/^0+(?=\d)/, "");
  const limit = String(Math.max(0, Math.trunc(maxBytes)));
  return (
    normalized.length > limit.length ||
    (normalized.length === limit.length && normalized > limit)
  );
}

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<ReadBodyResult> {
  if (contentLengthExceedsLimit(request.headers.get("content-length"), maxBytes)) {
    return { ok: false, tooLarge: true };
  }

  if (!request.body) {
    return { ok: true, raw: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, raw: new TextDecoder().decode(bytes) };
}

/**
 * 读取 JSON body：字节上限 → JSON.parse → zod safeParse
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<ParseBodyResult<T>> {
  let body: ReadBodyResult;
  try {
    body = await readBodyWithLimit(request, maxBytes);
  } catch {
    return { ok: false, status: 400, message: "无法读取请求体" };
  }

  // 使用 UTF-8 字节长度（与 Content-Length 更接近）
  if (!body.ok) {
    return {
      ok: false,
      status: 413,
      message: `请求体过大（>${maxBytes} 字节）`,
    };
  }

  const { raw } = body;

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

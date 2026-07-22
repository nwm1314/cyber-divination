import { randomUUID } from "crypto";

const HEADER = "x-request-id";

/** 从请求头读取或生成 requestId */
export function resolveRequestId(headers: Headers): string {
  const incoming = headers.get(HEADER)?.trim();
  if (incoming && incoming.length <= 128 && /^[\w\-.:]+$/.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export function requestIdHeader(requestId: string): Record<string, string> {
  return { [HEADER]: requestId };
}

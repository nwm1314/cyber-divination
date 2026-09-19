export type ApiLogFields = {
  requestId: string;
  route: string;
  method?: string;
  status?: number;
  durationMs?: number;
  /**
   * 客户端标识（限流用），取值随部署模式而定：
   * - trusted-proxy：**明文 IP**（`x-real-ip` / `x-forwarded-for` 首项）
   * - direct：已验签会话的 `user:<sha256(userId) 前 16 位>`，未登录/伪造为 `anon`
   *
   * 修复（P2 A7）：原注释写「已脱敏，如 IP 哈希前缀」，但实现返回明文 IP，
   * 注释与实现不符，现按实际行为更正。
   * 注意：可信代理模式下的明文 IP 属 PII，日志出境前应确保合规。
   */
  clientKey?: string;
  /** 术数：bazi | ziwei | liuyao */
  art?: string;
  /** LLM 模型名；无则 null */
  model?: string | null;
  /** LLM / 解读是否回落模板 */
  fallback?: boolean;
  fallbackReason?: string;
  errorCode?: string;
  message?: string;
  /** token usage（有则写，无则 null） */
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  /** 额外安全字段：禁止传 apiKey / prompt / Authorization */
  [key: string]: unknown;
};

/** 敏感键名；排除 *Tokens 用量字段（T211） */
function isSensitiveKey(keyHint: string): boolean {
  const k = keyHint.toLowerCase();
  // usage 字段允许明文数字
  if (
    k === "prompttokens" ||
    k === "completiontokens" ||
    k === "totaltokens"
  ) {
    return false;
  }
  return (
    /api[_-]?key/.test(k) ||
    k === "authorization" ||
    k === "password" ||
    k === "secret" ||
    k === "token" ||
    k.endsWith("token") ||
    k === "prompt" ||
    k.includes("bearer")
  );
}

function scrub(value: unknown, keyHint = ""): unknown {
  if (keyHint && isSensitiveKey(keyHint)) return "[redacted]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (/sk-[a-zA-Z0-9]{10,}/.test(value)) return "[redacted]";
    if (value.length > 500) return value.slice(0, 500) + "…";
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => scrub(v, String(i)));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrub(v, k);
    }
    return out;
  }
  return value;
}

/**
 * 结构化 JSON 日志（stdout）。
 * 永不打印 API Key / 完整 prompt / Authorization。
 */
export function logApi(
  level: "info" | "warn" | "error",
  event: string,
  fields: ApiLogFields,
): void {
  const payload = scrub({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  }) as Record<string, unknown>;

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

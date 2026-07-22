/**
 * 共享 OpenAI 兼容 Chat Completions 客户端（T211）。
 * - 解析 usage（prompt/completion/total tokens）
 * - 统一 logApi，禁止裸 console.error 打密钥/prompt
 */

import { logApi } from "@/lib/api/logger";

export type LlmArt = "bazi" | "ziwei" | "liuyao";

export type LlmUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type LlmChatResult = {
  content: string;
  model: string;
  usage: LlmUsage;
  durationMs: number;
};

export type LlmChatContext = {
  art: LlmArt;
  requestId?: string;
};

export type LlmChatErrorCode =
  | "LLM_NOT_CONFIGURED"
  | "LLM_HTTP_ERROR"
  | "LLM_EMPTY"
  | "LLM_NETWORK"
  | "LLM_UNKNOWN";

function parseTokenCount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return null;
}

function parseUsage(raw: unknown): LlmUsage {
  if (raw == null || typeof raw !== "object") {
    return { promptTokens: null, completionTokens: null, totalTokens: null };
  }
  const u = raw as Record<string, unknown>;
  return {
    promptTokens: parseTokenCount(u.prompt_tokens),
    completionTokens: parseTokenCount(u.completion_tokens),
    totalTokens: parseTokenCount(u.total_tokens),
  };
}

export function getLlmModel(): string {
  return process.env.LLM_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * 调用 Chat Completions；失败抛错（消息为 LLM_* 短码，不含密钥/正文）。
 */
export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  ctx: LlmChatContext,
): Promise<LlmChatResult> {
  const baseURL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const apiKey = process.env.LLM_API_KEY?.trim();
  const model = getLlmModel();
  const started = Date.now();
  const requestId = ctx.requestId ?? "llm-local";

  if (!apiKey) {
    logApi("warn", "llm.chat.skip", {
      requestId,
      route: "llm.chat",
      art: ctx.art,
      model,
      durationMs: 0,
      fallback: true,
      errorCode: "LLM_NOT_CONFIGURED",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    throw new Error("LLM_API_KEY not configured");
  }

  try {
    const res = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    const durationMs = Date.now() - started;

    if (!res.ok) {
      // 不把上游 body 写入日志（可能含敏感回显）
      logApi("error", "llm.chat.error", {
        requestId,
        route: "llm.chat",
        art: ctx.art,
        model,
        durationMs,
        fallback: true,
        errorCode: `LLM_HTTP_${res.status}`,
        status: res.status,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
      throw new Error(`LLM_HTTP_${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: unknown;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    const usage = parseUsage(data.usage);
    const resolvedModel = typeof data.model === "string" && data.model ? data.model : model;

    if (!content) {
      logApi("error", "llm.chat.error", {
        requestId,
        route: "llm.chat",
        art: ctx.art,
        model: resolvedModel,
        durationMs,
        fallback: true,
        errorCode: "LLM_EMPTY",
        ...usage,
      });
      throw new Error("LLM_EMPTY");
    }

    logApi("info", "llm.chat.ok", {
      requestId,
      route: "llm.chat",
      art: ctx.art,
      model: resolvedModel,
      durationMs,
      fallback: false,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });

    return {
      content,
      model: resolvedModel,
      usage,
      durationMs,
    };
  } catch (err) {
    if (err instanceof Error && (err.message.startsWith("LLM_") || err.message.includes("not configured"))) {
      throw err;
    }
    const durationMs = Date.now() - started;
    logApi("error", "llm.chat.error", {
      requestId,
      route: "llm.chat",
      art: ctx.art,
      model,
      durationMs,
      fallback: true,
      errorCode: "LLM_NETWORK",
      message: err instanceof Error ? err.message : "unknown",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    throw new Error("LLM_NETWORK");
  }
}

/** 从错误构造可汇总 errorCode */
export function llmErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("not configured") || msg.includes("LLM_API_KEY")) return "LLM_NOT_CONFIGURED";
  if (msg.startsWith("LLM_HTTP_")) return msg;
  if (msg === "LLM_EMPTY") return "LLM_EMPTY";
  if (msg === "LLM_NETWORK") return "LLM_NETWORK";
  return "LLM_UNKNOWN";
}

export function emptyUsage(): LlmUsage {
  return { promptTokens: null, completionTokens: null, totalTokens: null };
}

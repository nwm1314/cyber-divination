/**
 * 服务端探测：是否已配置可用 LLM（仅 boolean，不暴露 Key）。
 * 仅应在服务端 / Route Handler 中调用。
 */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

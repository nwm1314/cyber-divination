/**
 * 对外错误消息安全映射（P1）。
 *
 * 背景：`people/route.ts:80`、`people/[id]/route.ts:118`、
 * `charts/route.ts:106`、`ziwei-charts/route.ts:88`、
 * `liuyao-charts/route.ts:87` 曾把 `e.message` **原文返回给客户端**。
 * 其中应用自定义校验消息是安全的，但 `postgres` 驱动抛出的错误
 * 会包含表名、列名、约束名（如
 * `null value in column "question" violates not-null constraint`），
 * 属于内部结构泄露，可用于后续精确攻击。
 *
 * 策略：
 * - 白名单：仅放行本项目 **主动抛出** 的中文业务校验消息（有明确前缀或特征）；
 * - 其余一律返回固定文案，原文只记服务端日志。
 */

/** 业务校验消息的可信前缀（本项目自定义抛出） */
const TRUSTED_PREFIXES = [
  "profile.id",
  "chart.",
  "缺少",
  "无效的",
  "无法",
  "请",
] as const;

/**
 * 判断消息是否为本项目自定义的业务校验文案。
 * 判据：包含中文，且不包含典型的驱动/运行时错误特征。
 */
function isTrustedBusinessMessage(msg: string): boolean {
  if (!/[\u4e00-\u9fff]/.test(msg)) return false;
  // 驱动错误特征：SQL 片段、约束名、堆栈残留、英文技术短语
  const driverMarkers = [
    "constraint",
    "violates",
    "relation",
    "column",
    "syntax error",
    "duplicate key",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "at ",
    ".ts:",
    ".js:",
    "postgres",
    "SQL",
  ];
  const lower = msg.toLowerCase();
  if (driverMarkers.some((m) => lower.includes(m.toLowerCase()))) return false;
  // 过长消息多半是拼接的驱动详情
  if (msg.length > 200) return false;
  return TRUSTED_PREFIXES.some((p) => msg.startsWith(p)) || msg.length <= 60;
}

/**
 * 把内部异常转换为可安全返回给客户端的消息。
 *
 * @param err 捕获到的异常
 * @param fallback 不可信时的固定文案（面向用户、可操作）
 * @param onLog 可选：把原始错误交给调用方记录（原文只进服务端日志）
 */
export function toSafeErrorMessage(
  err: unknown,
  fallback: string,
  onLog?: (original: string) => void,
): string {
  const original = err instanceof Error ? err.message : String(err ?? "");
  if (onLog) {
    try {
      onLog(original);
    } catch {
      // 日志失败不得影响错误响应本身
    }
  }
  if (original && isTrustedBusinessMessage(original)) return original;
  return fallback;
}

/**
 * 统一引擎信封 · inputFingerprint（GAP-5 / P-3 T-1）
 *
 * ## 为什么需要它
 *
 * 信任模型里最基础的一环是「**同一输入 → 同一个盘**」必须可自证。
 * 此前三引擎都没有该字段（全项目 0 命中），用户无法复算、无法做差异对照，
 * 也无法判断自己看到的盘是否来自当前输入。
 *
 * ## 设计约束
 *
 * 1. **只哈希输入**，绝不哈希派生结果。否则「指纹不一致」既可能是输入变了，
 *    也可能是引擎版本变了，无法区分——那就失去了复算意义。
 *    需要区分引擎版本时，用户对照 meta.engineVersion / ruleSetVersion。
 * 2. **纯函数、零依赖**：不用 node:crypto，因为三引擎的 meta 也可能在
 *    客户端组件中读取（如 TrustPanel）。使用确定性 FNV-1a 64 位变体，
 *    输出 16 位十六进制；不用于密码学，只用于「同一性」比对。
 * 3. **规范化输入**：键按字典序排序，数值统一格式，避免 JS 对象键序
 *    或 `1` vs `1.0` 造成同输入不同指纹。
 * 4. **不含 PII 明文**：指纹本身不携带姓名、生日原文，只输出摘要，
 *    因此可以安全地展示给用户与写入分享快照。
 */

export type FingerprintInput = Record<string, unknown>;

/**
 * FNV-1a 64 位（用两个 32 位半区模拟，避免 BigInt 在旧引擎上的开销）。
 * 仅用于同一性比对，非密码学用途。
 */
function fnv1a64Hex(input: string): string {
  // 32 位 FNV-1a 参数
  const PRIME = 0x01000193;
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, PRIME) >>> 0;
    h2 ^= c + ((i << 3) & 0xff);
    h2 = Math.imul(h2, PRIME) >>> 0;
  }

  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/**
 * 规范化任意值为确定性字符串：
 * - undefined / 函数 / symbol → 省略（不作为输入的一部分）
 * - null → "null"
 * - 数值 → 统一字符串（NaN/Infinity 显式标记）
 * - 数组 → 保序（数组顺序是语义的一部分，如六爻爻位）
 * - 对象 → 键按字典序排序（对象键序不是语义）
 */
function canonicalize(value: unknown): string | undefined {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (value === null) return "null";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      const c = canonicalize(item);
      parts.push(c === undefined ? "null" : c);
    }
    return `[${parts.join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const c = canonicalize(obj[k]);
      if (c === undefined) continue; // 省略 undefined，使「字段缺省」与「显式 undefined」等价
      parts.push(`${JSON.stringify(k)}:${c}`);
    }
    return `{${parts.join(",")}}`;
  }
  return undefined;
}

/**
 * 计算输入指纹。
 *
 * @param namespace 引擎命名空间，如 `bazi` / `ziwei` / `liuyao`。
 *   参与哈希，确保三引擎相同输入不会产生相同指纹。
 * @param input 仅含**输入**字段的对象（出生信息 / 卦象取值 / 所问事项等）。
 * @returns 形如 `bazi-1a2b3c4d5e6f7a8b` 的指纹字符串
 */
export function computeInputFingerprint(
  namespace: string,
  input: FingerprintInput,
): string {
  const canonical = canonicalize(input) ?? "{}";
  return `${namespace}-${fnv1a64Hex(`${namespace}\u0000${canonical}`)}`;
}

/** 指纹版本：规范化算法变更时必须递增，使旧指纹可被识别 */
export const INPUT_FINGERPRINT_VERSION = "1";

/** 供 UI 展示的指纹短形式（前 8 位哈希部分） */
export function shortFingerprint(fingerprint: string | undefined): string {
  if (!fingerprint) return "";
  const idx = fingerprint.indexOf("-");
  if (idx < 0) return fingerprint.slice(0, 8);
  return fingerprint.slice(idx + 1, idx + 9);
}

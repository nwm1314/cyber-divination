/**
 * 生产环境是否禁止以本地 JSON 文件作为分享快照存储。
 *
 * 攻击/故障场景：`share/index.ts:20-27` 的 driver 默认值为 `"local"`，
 * 而 `LocalFileShareStore`（`local-file.ts:26-45`）在每次写入时
 * **全量读取整个 JSON → 改一条 → 全量写回**，无任何文件锁。
 *
 * 后果（多实例或无持久磁盘部署下）：
 * 1. 实例 A 与实例 B 并发写 → 后写者覆盖前者 → **静默丢分享链接**；
 * 2. 无持久盘的 Serverless/容器重建 → 分享链接随机 404；
 * 3. 分享数据不在 Postgres 备份范围内 → 备份恢复也无法找回。
 *
 * 注意：DB 与限流两处驱动降级都是 fail-fast 抛错，设计良好；
 * 唯独分享存储缺少生产校验，此处补齐。
 */
export function isFileShareStoreForbiddenInProd(): boolean {
  const raw = (process.env.SHARE_STORE_DRIVER ?? "").trim().toLowerCase();
  if (raw === "upstash") return false;
  // "local"、"" 或任何非 upstash 取值都会落到 LocalFileShareStore
  return true;
}

/**
 * 生产配置 fail-fast 校验（T302）
 * 在 instrumentation / 部署前脚本调用。
 */

import { DEV_AUTH_SECRET_FALLBACK } from "@/lib/auth/constants";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** AUTH_SECRET 最小长度（字符）。HMAC-SHA256 密钥至少应与摘要长度同量级。 */
export const AUTH_SECRET_MIN_LENGTH = 32;

/**
 * 常见弱密钥（不区分大小写）。这些值在示例、文档、教程中高频出现，
 * 攻击者的字典里一定有，必须拒绝。
 */
const WEAK_AUTH_SECRETS = new Set([
  DEV_AUTH_SECRET_FALLBACK.toLowerCase(),
  "secret",
  "changeme",
  "change-me",
  "change_me",
  "password",
  "test",
  "prod-secret",
  "dev-secret",
  "auth-secret",
  "authsecret",
  "your-secret",
  "your_secret_key",
  "supersecret",
  "super-secret",
  "cyber-divination",
]);

/**
 * 常见弱词根（小写）。命中即判定为可猜测 —— 攻击者字典按"包含"匹配，
 * 因此这里也必须按"包含"而非"全等"判定：
 * `ChangeMe-ChangeMe-…`、`prod-secret-prod-secret-…` 这类"把短词重复凑长度"
 * 的构造，其真实熵等于词根熵，长度达标毫无意义。
 */
const WEAK_AUTH_SECRET_SUBSTRINGS = [
  "secret",
  "password",
  "passwd",
  "changeme",
  "change-me",
  "change_me",
  "your-secret",
  "your_secret",
  "auth-secret",
  "authsecret",
  "super-secret",
  "supersecret",
  "prod-secret",
  "dev-secret",
  "test",
  "cyber-divination",
  "example",
  "placeholder",
  "default",
] as const;

/**
 * 判定 AUTH_SECRET 是否为可接受的强密钥。
 * 攻击面：会话 token = base64url(payload).HMAC-SHA256(body, secret)。
 * 密钥弱则可离线枚举伪造任意 sub 的会话 Cookie（`session.ts:86-89`），
 * 且 `verifySessionToken` 只验签名不查库（`session.ts:110-129`），伪造即通过。
 *
 * 因此仅校验"非空"不足以防账号接管 —— 必须同时约束**长度**与**可猜测性**。
 *
 * @returns 不通过时返回原因描述；通过返回 null。
 */
export function checkAuthSecretStrength(secret: string | undefined): string | null {
  const value = secret?.trim();
  if (!value) return "AUTH_SECRET 为生产必填（签名会话 Cookie）";

  if (value.length < AUTH_SECRET_MIN_LENGTH) {
    return `AUTH_SECRET 强度不足：长度 ${value.length}，生产要求至少 ${AUTH_SECRET_MIN_LENGTH} 个字符`;
  }

  const lower = value.toLowerCase();
  if (WEAK_AUTH_SECRETS.has(lower)) {
    return "AUTH_SECRET 强度不足：该值属常见弱密钥/示例值，必须改为随机生成的高熵密钥";
  }
  const hit = WEAK_AUTH_SECRET_SUBSTRINGS.find((w) => lower.includes(w));
  if (hit) {
    return `AUTH_SECRET 强度不足：包含常见可猜测词根 "${hit}"，请改为随机生成的高熵密钥（如 openssl rand -base64 48）`;
  }

  // 全同字符（aaaaaaaa…）或单调序列（abcdef…/123456…）都无熵可言
  if (/^(.)\1+$/.test(value)) {
    return "AUTH_SECRET 强度不足：不得为单一重复字符";
  }
  if (isMonotonicSequence(value)) {
    return "AUTH_SECRET 强度不足：不得为连续递增/递减字符序列";
  }
  if (hasRepeatedBlock(value)) {
    return "AUTH_SECRET 强度不足：检测到重复片段，属低熵构造（如把短词拼接/重复）";
  }

  // 字符种类过少时同样不具备足够熵（如纯小写 32 位 ≈ 150 bit 尚可，
  // 但单一字符类且长度刚过线时风险偏高，要求至少两类字符）
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(value),
  ).length;
  if (classes < 2) {
    return "AUTH_SECRET 强度不足：至少需要包含两类字符（大小写/数字/符号中的两类）";
  }

  return null;
}

/** 检测连续递增/递减的字符序列（如 abcdef、654321） */
function isMonotonicSequence(value: string): boolean {
  let asc = true;
  let desc = true;
  for (let i = 1; i < value.length; i++) {
    const diff = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (diff !== 1) asc = false;
    if (diff !== -1) desc = false;
    if (!asc && !desc) return false;
  }
  return asc || desc;
}

/**
 * 检测整段是否为某个较短片段的重复（如 "abcabcabc"、"prod-secretprod-secret"）。
 *
 * 这类值虽然长度达标、字符类也可能达标，但真实熵 = 片段熵，
 * 攻击者字典里同样会有（把常见短词重复拼接是最典型的"凑长度"做法）。
 */
function hasRepeatedBlock(value: string): boolean {
  const n = value.length;
  // 片段的真实熵上限很低：只检查长度 <= n/2 的片段
  for (let len = 1; len <= n / 2; len++) {
    if (n % len !== 0) continue;
    const block = value.slice(0, len);
    let repeated = true;
    for (let i = len; i < n; i += len) {
      if (value.slice(i, i + len) !== block) {
        repeated = false;
        break;
      }
    }
    if (repeated) return true;
  }
  return false;
}

function isTruthyOne(raw: string | undefined): boolean {
  return (raw ?? "").trim() === "1";
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function validateRateLimitConfig(errors: string[]): void {
  const driver = (process.env.RATE_LIMIT_DRIVER ?? "").trim().toLowerCase();
  if (driver !== "redis") {
    errors.push(
      "生产必须设置 RATE_LIMIT_DRIVER=redis；禁止静默使用 memory 限流（多实例保护）",
    );
  } else {
    if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) {
      errors.push("RATE_LIMIT_DRIVER=redis 时必须配置 UPSTASH_REDIS_REST_URL");
    }
    if (!process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
      errors.push("RATE_LIMIT_DRIVER=redis 时必须配置 UPSTASH_REDIS_REST_TOKEN");
    }
  }

  const trustedProxy = process.env.RATE_LIMIT_TRUSTED_PROXY?.trim();
  if (trustedProxy !== "0" && trustedProxy !== "1") {
    errors.push(
      "生产必须明确设置 RATE_LIMIT_TRUSTED_PROXY=0（直连）或 1（可信代理）",
    );
  }
}

/**
 * 生产环境是否允许 file 作为账号/云端主存储。
 * - CLOUD_STORE_DRIVER=file → 禁止
 * - CLOUD_STORE_DRIVER=postgres 但无 DATABASE_URL → 禁止（与 driver 一致）
 * - 未设 driver 且无 DATABASE_URL → 会回落 file，生产禁止
 * - 未设 driver 且有 DATABASE_URL → 自动 postgres，允许
 */
export function isFileCloudStoreForbiddenInProd(): boolean {
  const raw = (process.env.CLOUD_STORE_DRIVER ?? "").trim().toLowerCase();
  if (raw === "file") return true;
  if (raw === "postgres") return !hasDatabaseUrl();
  // 自动：无 DATABASE_URL 则 file
  return !hasDatabaseUrl();
}

/**
 * NODE_ENV=production 时校验关键配置；不通过则抛错。
 * 非 production 直接返回。
 */
export function validateProductionConfig(): void {
  if (!isProduction()) return;

  const errors: string[] = [];

  const authSecretError = checkAuthSecretStrength(process.env.AUTH_SECRET);
  if (authSecretError) {
    errors.push(authSecretError);
  }

  if (isTruthyOne(process.env.AUTH_ALLOW_DEV_LOGIN)) {
    errors.push("生产禁止 AUTH_ALLOW_DEV_LOGIN=1（开发假登录）");
  }

  if (isFileCloudStoreForbiddenInProd()) {
    const driver = (process.env.CLOUD_STORE_DRIVER ?? "").trim() || "(auto)";
    errors.push(
      `生产禁止以 file 作为账号/云端主存储（CLOUD_STORE_DRIVER=${driver}）。请设置 DATABASE_URL 且 CLOUD_STORE_DRIVER=postgres（或省略 driver 并配置 DATABASE_URL）`,
    );
  }

  if (isFileShareStoreForbiddenInProd()) {
    const driver = (process.env.SHARE_STORE_DRIVER ?? "").trim() || "(default: local)";
    errors.push(
      `生产禁止以本地 JSON 文件作为分享快照存储（SHARE_STORE_DRIVER=${driver}）。请设置 SHARE_STORE_DRIVER=upstash 并配置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN；本地文件存储在无持久磁盘或多实例下会静默丢失分享链接`,
    );
  }

  validateRateLimitConfig(errors);

  if (errors.length > 0) {
    throw new Error(
      `[validate-prod] 生产配置校验失败:\n- ${errors.join("\n- ")}`,
    );
  }
}

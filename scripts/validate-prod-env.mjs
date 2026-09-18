/**
 * 部署前生产环境变量检查（T302）
 * 用法：NODE_ENV=production node scripts/validate-prod-env.mjs
 * 或：npm run check:prod-env
 *
 * 逻辑与 src/lib/config/validate-prod.ts 对齐（纯 Node，无 TS 路径别名）。
 */

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function isFileCloudStoreForbiddenInProd() {
  const raw = (process.env.CLOUD_STORE_DRIVER ?? "").trim().toLowerCase();
  if (raw === "file") return true;
  if (raw === "postgres") return !hasDatabaseUrl();
  return !hasDatabaseUrl();
}

/** 与 src/lib/config/validate-prod.ts 的 isFileShareStoreForbiddenInProd 对齐 */
function isFileShareStoreForbiddenInProd() {
  const raw = (process.env.SHARE_STORE_DRIVER ?? "").trim().toLowerCase();
  return raw !== "upstash";
}

/** 与 src/lib/config/validate-prod.ts 的 AUTH_SECRET_MIN_LENGTH 对齐 */
const AUTH_SECRET_MIN_LENGTH = 32;

const DEV_AUTH_SECRET_FALLBACK = "cyber-divination-dev-secret-change-me";

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
];

function isMonotonicSequence(value) {
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

function hasRepeatedBlock(value) {
  const n = value.length;
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

/** 与 src/lib/config/validate-prod.ts 的 checkAuthSecretStrength 对齐 */
function checkAuthSecretStrength(secret) {
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
  if (/^(.)\1+$/.test(value)) {
    return "AUTH_SECRET 强度不足：不得为单一重复字符";
  }
  if (isMonotonicSequence(value)) {
    return "AUTH_SECRET 强度不足：不得为连续递增/递减字符序列";
  }
  if (hasRepeatedBlock(value)) {
    return "AUTH_SECRET 强度不足：检测到重复片段，属低熵构造（如把短词拼接/重复）";
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(value),
  ).length;
  if (classes < 2) {
    return "AUTH_SECRET 强度不足：至少需要包含两类字符（大小写/数字/符号中的两类）";
  }
  return null;
}

function validateRateLimitConfig(errors) {
  const driver = (process.env.RATE_LIMIT_DRIVER ?? "").trim().toLowerCase();
  if (driver !== "redis") {
    errors.push("production requires RATE_LIMIT_DRIVER=redis");
  } else {
    if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) {
      errors.push("RATE_LIMIT_DRIVER=redis requires UPSTASH_REDIS_REST_URL");
    }
    if (!process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
      errors.push("RATE_LIMIT_DRIVER=redis requires UPSTASH_REDIS_REST_TOKEN");
    }
  }

  const trustedProxy = process.env.RATE_LIMIT_TRUSTED_PROXY?.trim();
  if (trustedProxy !== "0" && trustedProxy !== "1") {
    errors.push("production requires RATE_LIMIT_TRUSTED_PROXY=0 or 1");
  }
}

function validateProductionConfig() {
  if (!isProduction()) {
    console.log(
      "[check:prod-env] NODE_ENV 非 production，跳过校验（部署前请设 NODE_ENV=production）",
    );
    return;
  }

  const errors = [];

  const authSecretError = checkAuthSecretStrength(process.env.AUTH_SECRET);
  if (authSecretError) {
    errors.push(authSecretError);
  }

  if ((process.env.AUTH_ALLOW_DEV_LOGIN ?? "").trim() === "1") {
    errors.push("生产禁止 AUTH_ALLOW_DEV_LOGIN=1（开发假登录）");
  }

  if (isFileCloudStoreForbiddenInProd()) {
    const driver = (process.env.CLOUD_STORE_DRIVER ?? "").trim() || "(auto)";
    errors.push(
      `生产禁止以 file 作为账号/云端主存储（CLOUD_STORE_DRIVER=${driver}）。请设置 DATABASE_URL 且 CLOUD_STORE_DRIVER=postgres（或省略 driver 并配置 DATABASE_URL）`,
    );
  }

  if (isFileShareStoreForbiddenInProd()) {
    const driver =
      (process.env.SHARE_STORE_DRIVER ?? "").trim() || "(default: local)";
    errors.push(
      `生产禁止以本地 JSON 文件作为分享快照存储（SHARE_STORE_DRIVER=${driver}）。请设置 SHARE_STORE_DRIVER=upstash 并配置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN；本地文件存储在无持久磁盘或多实例下会静默丢失分享链接`,
    );
  }

  validateRateLimitConfig(errors);

  if (errors.length > 0) {
    console.error("[check:prod-env] 生产配置校验失败:");
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log("[check:prod-env] 生产配置校验通过");
}

validateProductionConfig();

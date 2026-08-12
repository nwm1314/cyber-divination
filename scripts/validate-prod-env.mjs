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

  if (!process.env.AUTH_SECRET?.trim()) {
    errors.push("AUTH_SECRET 为生产必填（签名会话 Cookie）");
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

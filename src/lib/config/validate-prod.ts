/**
 * 生产配置 fail-fast 校验（T302）
 * 在 instrumentation / 部署前脚本调用。
 */

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isTruthyOne(raw: string | undefined): boolean {
  return (raw ?? "").trim() === "1";
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
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

  if (!process.env.AUTH_SECRET?.trim()) {
    errors.push("AUTH_SECRET 为生产必填（签名会话 Cookie）");
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

  if (errors.length > 0) {
    throw new Error(
      `[validate-prod] 生产配置校验失败:\n- ${errors.join("\n- ")}`,
    );
  }
}

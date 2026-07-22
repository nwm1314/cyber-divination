/**
 * Postgres 客户端（T221）
 * - 驱动：postgres（https://github.com/porsager/postgres）
 * - DATABASE_URL 缺省时 isDatabaseConfigured()=false，账号云端可回落 JSON 文件
 */

import "server-only";
import postgres, { type Sql } from "postgres";
import { SCHEMA_SQL } from "./schema";

let sql: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabaseUrl(): string | null {
  const u = process.env.DATABASE_URL?.trim();
  return u || null;
}

/**
 * 获取 SQL 客户端；未配置 DATABASE_URL 时抛错（调用方应先 isDatabaseConfigured）
 */
export function getSql(): Sql {
  if (sql) return sql;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL 未配置。生产账号/云端档案请设置托管 Postgres 连接串（见 docs/DEPLOY.md）",
    );
  }
  sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return sql;
}

/**
 * 应用 DDL（幂等）；请求路径中的存储层仍会调用。
 *
 * 生产建议：部署前执行 `npm run db:migrate` 预跑 DDL，
 * 并设置 `DB_SKIP_ENSURE_SCHEMA=1` 跳过请求路径建表，降低并发 DDL 风险。
 * 见 docs/DEPLOY.md。
 */
export async function ensureSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if ((process.env.DB_SKIP_ENSURE_SCHEMA ?? "").trim() === "1") return;
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getSql();
      await db.unsafe(SCHEMA_SQL);
    })();
  }
  await schemaReady;
}

/** 健康检查 */
export async function dbHealthCheck(): Promise<{ ok: boolean; message: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL 未配置" };
  }
  try {
    const db = getSql();
    await db`SELECT 1 AS ok`;
    return { ok: true, message: "ok" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "db error",
    };
  }
}

/** 测试用重置连接缓存 */
export function resetDbClientForTests(): void {
  if (sql) {
    void sql.end({ timeout: 1 }).catch(() => undefined);
  }
  sql = null;
  schemaReady = null;
}

/**
 * 幂等执行 Postgres DDL（T302）
 * 用法：DATABASE_URL=... npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrateSqlPath = path.join(root, "src", "lib", "db", "migrate.sql");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "[db:migrate] DATABASE_URL 未配置。请设置 Postgres 连接串后再执行 npm run db:migrate",
  );
  process.exit(1);
}

if (!fs.existsSync(migrateSqlPath)) {
  console.error(`[db:migrate] 找不到迁移文件: ${migrateSqlPath}`);
  process.exit(1);
}

const sqlText = fs.readFileSync(migrateSqlPath, "utf8");

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  prepare: false,
});

try {
  console.log("[db:migrate] 开始执行幂等 DDL…");
  await sql.unsafe(sqlText);
  console.log("[db:migrate] 完成（CREATE TABLE/INDEX IF NOT EXISTS）");
  process.exitCode = 0;
} catch (err) {
  console.error(
    "[db:migrate] 失败:",
    err instanceof Error ? err.message : String(err),
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => undefined);
}

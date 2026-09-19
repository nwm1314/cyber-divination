import { describe, expect, it } from "vitest";
import {
  JSON_TO_PG_MAP,
  PG_TABLES,
  SCHEMA_SQL,
} from "./schema";
import { isDatabaseConfigured } from "./client";

describe("db schema（T220）", () => {
  it("含 users / 三术 / magic_links 表", () => {
    expect(PG_TABLES.users).toBe("users");
    expect(PG_TABLES.baziCharts).toBe("bazi_charts");
    expect(PG_TABLES.ziweiCharts).toBe("ziwei_charts");
    expect(PG_TABLES.liuyaoCharts).toBe("liuyao_charts");
    expect(PG_TABLES.magicLinks).toBe("magic_links");
    expect(SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(SCHEMA_SQL).toMatch(/liuyao_charts/);
    expect(SCHEMA_SQL).toMatch(/question\s+TEXT NOT NULL/);
  });

  it("JSON→PG 映射表完整", () => {
    expect(JSON_TO_PG_MAP["data/users.json"].table).toBe("users");
    expect(JSON_TO_PG_MAP["data/cloud-charts.json"].table).toBe("bazi_charts");
  });

  it("无 DATABASE_URL 时未配置", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(isDatabaseConfigured()).toBe(false);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });

  /**
   * B4 乐观锁列。CREATE TABLE IF NOT EXISTS 不会给已存在的旧表加列，
   * 所以老库必须靠幂等 ALTER 收敛——两处 DDL（SCHEMA_SQL 与 migrate.sql）
   * 都要有，且必须一致（migrate.sql 是部署前预跑的那份）。
   */
  describe("乐观锁 version 列（B4）", () => {
    const GUARDED_TABLES = ["people", "bazi_charts"];

    for (const table of GUARDED_TABLES) {
      it(`SCHEMA_SQL 的 ${table} 建表含 version`, () => {
        const block = new RegExp(
          `CREATE TABLE IF NOT EXISTS ${table}[\\s\\S]*?\\);`,
        ).exec(SCHEMA_SQL)?.[0];
        expect(block, `未找到 ${table} 建表语句`).toBeTruthy();
        expect(block).toMatch(/version\s+INTEGER NOT NULL DEFAULT 0/);
      });

      it(`SCHEMA_SQL 含 ${table} 的幂等 ALTER`, () => {
        expect(SCHEMA_SQL).toMatch(
          new RegExp(
            `ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;`,
          ),
        );
      });
    }

    it("migrate.sql 与 SCHEMA_SQL 的 version 相关语句一致", async () => {
      const { readFile } = await import("node:fs/promises");
      const migrate = await readFile(
        new URL("./migrate.sql", import.meta.url),
        "utf8",
      );
      const of = (sql: string) =>
        [...sql.matchAll(/ALTER TABLE (\w+)\s+ADD COLUMN IF NOT EXISTS version/g)]
          .map((m) => m[1])
          .sort();
      expect(of(migrate)).toEqual(of(SCHEMA_SQL));
      expect(of(migrate)).toEqual(["bazi_charts", "people"]);
    });

    it("未接乐观锁的表不被偷偷加列（避免死列）", () => {
      // users / ziwei_charts / liuyao_charts 尚无 expectedVersion 执行点，
      // 加列就是无人读写的死 schema；接入时应同步补这里的期望值。
      expect(SCHEMA_SQL).not.toMatch(/ALTER TABLE users\s+ADD COLUMN IF NOT EXISTS version/);
      expect(SCHEMA_SQL).not.toMatch(/ALTER TABLE ziwei_charts\s+ADD COLUMN IF NOT EXISTS version/);
      expect(SCHEMA_SQL).not.toMatch(/ALTER TABLE liuyao_charts\s+ADD COLUMN IF NOT EXISTS version/);
    });
  });
});

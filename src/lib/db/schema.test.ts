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
});

/**
 * Postgres 数据模型契约（T220）
 * 与现有 Cloud* / User / Person / LiuyaoChart API 形状兼容。
 */

import type { UserId } from "@/lib/types/user";

/** 表名常量 */
export const PG_TABLES = {
  users: "users",
  magicLinks: "magic_links",
  people: "people",
  baziCharts: "bazi_charts",
  ziweiCharts: "ziwei_charts",
  liuyaoCharts: "liuyao_charts",
} as const;

/**
 * 行级类型（与 SQL 对齐；JSON 列在应用层解析为领域类型）
 */
export type PgUserRow = {
  id: UserId;
  email: string;
  display_name: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
};

export type PgMagicLinkRow = {
  token_hash: string;
  email: string;
  display_name: string | null;
  callback_url: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type PgPersonRow = {
  id: string;
  user_id: UserId;
  payload: unknown;
  /** 乐观锁版本（B4）；迁移前旧行为 0 */
  version: number;
  created_at: string;
  updated_at: string;
};

export type PgBaziChartRow = {
  id: string;
  user_id: UserId;
  profile_json: unknown;
  chart_json: unknown;
  report_json: unknown | null;
  calibrate_json: unknown | null;
  /** 乐观锁版本（B4）；迁移前旧行为 0 */
  version: number;
  created_at: string;
  updated_at: string;
};

export type PgZiweiChartRow = {
  id: string;
  user_id: UserId;
  chart_json: unknown;
  solar_date: string | null;
  created_at: string;
  updated_at: string;
};

export type PgLiuyaoChartRow = {
  id: string;
  user_id: UserId;
  question: string;
  chart_json: unknown;
  created_at: string;
  updated_at: string;
};

/** JSON 文件 → PG 字段映射（T223 迁移用） */
export const JSON_TO_PG_MAP = {
  "data/users.json": {
    table: PG_TABLES.users,
    map: "User[] → id,email,display_name,image,created_at,updated_at",
  },
  "data/cloud-charts.json": {
    table: PG_TABLES.baziCharts,
    map: "CloudChartRecord → profile_json/chart_json/report_json/calibrate_json",
  },
  "data/cloud-ziwei.json": {
    table: PG_TABLES.ziweiCharts,
    map: "CloudZiweiRecord → chart_json,solar_date",
  },
  "data/cloud-people.json": {
    table: PG_TABLES.people,
    map: "Person → payload JSONB",
  },
} as const;

export const SCHEMA_SQL = `
-- cyber-divination W19 schema (T220)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  display_name  TEXT,
  callback_url  TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);

CREATE TABLE IF NOT EXISTS people (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload       JSONB NOT NULL,
  version       INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS people_user_id_idx ON people(user_id);

CREATE TABLE IF NOT EXISTS bazi_charts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_json    JSONB NOT NULL,
  chart_json      JSONB NOT NULL,
  report_json     JSONB,
  calibrate_json  JSONB,
  version         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bazi_charts_user_id_idx ON bazi_charts(user_id);

CREATE TABLE IF NOT EXISTS ziwei_charts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_json    JSONB NOT NULL,
  solar_date    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ziwei_charts_user_id_idx ON ziwei_charts(user_id);

CREATE TABLE IF NOT EXISTS liuyao_charts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  chart_json    JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS liuyao_charts_user_id_idx ON liuyao_charts(user_id);

-- 乐观锁列补齐（B4）：CREATE TABLE IF NOT EXISTS 不会给已存在的旧表加列，
-- 因此老库必须靠这两条幂等 ALTER 收敛。已有行取默认 0，旧客户端不带
-- expectedVersion 时仍按后写覆盖，行为不变。
ALTER TABLE people      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bazi_charts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
`.trim();

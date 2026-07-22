-- 幂等迁移：见 SCHEMA_SQL in src/lib/db/schema.ts
-- 用法：
--   npm run db:migrate
--   或 psql "$DATABASE_URL" -f src/lib/db/migrate.sql
-- 生产建议预跑本文件；可选 DB_SKIP_ENSURE_SCHEMA=1 跳过请求路径 ensureSchema。

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

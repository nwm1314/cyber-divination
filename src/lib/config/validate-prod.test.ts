import { afterEach, describe, expect, it } from "vitest";
import {
  AUTH_SECRET_MIN_LENGTH,
  checkAuthSecretStrength,
  ensuresSchemaOnRequestPath,
  isFileCloudStoreForbiddenInProd,
  isFileShareStoreForbiddenInProd,
  validateProductionConfig,
} from "./validate-prod";

const env = process.env as Record<string, string | undefined>;

/** 测试用强密钥（≥32 字符、含多字符类、不含任何弱词根/重复片段） */
const STRONG_SECRET = "9f3Kx7Qw2Lm5Zt8Vb1Nc4Rdy6Hj0Pa2Sg6Uh8Wk3Ej5Tn";

const ENV_KEYS = [
  "NODE_ENV",
  "AUTH_SECRET",
  "AUTH_ALLOW_DEV_LOGIN",
  "CLOUD_STORE_DRIVER",
  "DATABASE_URL",
  "DB_SKIP_ENSURE_SCHEMA",
  "RATE_LIMIT_DRIVER",
  "RATE_LIMIT_TRUSTED_PROXY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SHARE_STORE_DRIVER",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

function snapshotEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else env[k] = v;
  }
}

function clearProdRelated() {
  delete process.env.AUTH_SECRET;
  delete process.env.AUTH_ALLOW_DEV_LOGIN;
  delete process.env.CLOUD_STORE_DRIVER;
  delete process.env.DATABASE_URL;
  delete process.env.DB_SKIP_ENSURE_SCHEMA;
  delete process.env.RATE_LIMIT_DRIVER;
  delete process.env.RATE_LIMIT_TRUSTED_PROXY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.SHARE_STORE_DRIVER;
}

function setValidRateLimitConfig() {
  process.env.RATE_LIMIT_DRIVER = "redis";
  process.env.RATE_LIMIT_TRUSTED_PROXY = "0";
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  // 分享存储也必须显式指向 upstash（P0：本地文件在多实例下静默丢数据）
  process.env.SHARE_STORE_DRIVER = "upstash";
}

describe("validateProductionConfig（T302）", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("非 production 不校验", () => {
    snapshotEnv();
    env.NODE_ENV = "development";
    clearProdRelated();
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("生产缺 AUTH_SECRET 抛错", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    expect(() => validateProductionConfig()).toThrow(/AUTH_SECRET/);
  });

  it("生产 AUTH_ALLOW_DEV_LOGIN=1 抛错", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.AUTH_ALLOW_DEV_LOGIN = "1";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    expect(() => validateProductionConfig()).toThrow(/AUTH_ALLOW_DEV_LOGIN/);
  });

  it("生产 file driver 抛错", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.CLOUD_STORE_DRIVER = "file";
    expect(() => validateProductionConfig()).toThrow(/file/);
  });

  it("生产无 DATABASE_URL 且未强制 postgres 时抛错（回落 file）", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    expect(() => validateProductionConfig()).toThrow(/file|DATABASE_URL/);
  });

  it("生产合法配置通过", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    // B2：生产改为部署前预跑 DDL，请求路径不再建表
    process.env.DB_SKIP_ENSURE_SCHEMA = "1";
    setValidRateLimitConfig();
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("生产禁止 memory 限流或缺少可信代理模式", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.RATE_LIMIT_DRIVER = "memory";
    expect(() => validateProductionConfig()).toThrow(/RATE_LIMIT_DRIVER=redis/);
  });

  it("生产 Redis 缺少凭证时 fail-fast", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.RATE_LIMIT_TRUSTED_PROXY = "1";
    expect(() => validateProductionConfig()).toThrow(/UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN/);
  });

  it("生产拒绝未明确的可信代理模式", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    expect(() => validateProductionConfig()).toThrow(/RATE_LIMIT_TRUSTED_PROXY/);
  });

  it("isFileCloudStoreForbiddenInProd：postgres + DATABASE_URL 允许", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    expect(isFileCloudStoreForbiddenInProd()).toBe(false);
  });
});

/**
 * P0 安全回归：AUTH_SECRET 强度校验。
 *
 * 原缺陷：`validate-prod.ts` 仅校验"非空"，`session.ts:46-53` 也无长度/熵校验。
 * 攻击场景：运维设 `AUTH_SECRET=123` → 服务正常启动 → 攻击者离线枚举弱密钥，
 * 伪造 `base64url(payload).HMAC-SHA256(body, 弱密钥)` → 携带该 Cookie 请求
 * `/api/charts` 读取受害者全部命盘。会话 token 只验签名不查库
 * （`session.ts:110-129`），伪造即通过。
 *
 * 以下用例逐个复现该攻击面并断言被拦截。
 */
describe("checkAuthSecretStrength（P0 修复回归）", () => {
  it("拒绝空值与未配置", () => {
    expect(checkAuthSecretStrength(undefined)).toMatch(/必填/);
    expect(checkAuthSecretStrength("")).toMatch(/必填/);
    expect(checkAuthSecretStrength("   ")).toMatch(/必填/);
  });

  it("拒绝长度不足的密钥（原缺陷可被利用的直接原因）", () => {
    // 攻击者最想看到的：短到可离线暴力枚举
    for (const weak of ["123", "secret", "abc", "hunter2", "1234567890"]) {
      expect(checkAuthSecretStrength(weak)).toMatch(/强度不足/);
    }
  });

  it("拒绝恰好低于最小长度的边界值", () => {
    const almost = "Aa1".repeat(Math.floor((AUTH_SECRET_MIN_LENGTH - 1) / 3));
    const padding = "x".repeat((AUTH_SECRET_MIN_LENGTH - 1) - almost.length);
    const value = almost + padding;
    expect(value.length).toBe(AUTH_SECRET_MIN_LENGTH - 1);
    expect(checkAuthSecretStrength(value)).toMatch(/强度不足/);
  });

  it("接受恰好达到最小长度的合规密钥", () => {
    const value = "Qw7Zx2Lm5Vb8Nc4Ry6Hj0Pa3Sg9Uh1Wk";
    expect(value.length).toBeGreaterThanOrEqual(AUTH_SECRET_MIN_LENGTH);
    expect(checkAuthSecretStrength(value)).toBeNull();
  });

  it("拒绝项目自带的开发占位密钥（会被复制到生产的值）", () => {
    expect(
      checkAuthSecretStrength("cyber-divination-dev-secret-change-me"),
    ).toMatch(/弱密钥|强度不足/);
  });

  it("拒绝常见弱密钥字典成员（大小写不敏感）", () => {
    for (const weak of [
      "ChangeMe-ChangeMe-ChangeMe-ChangeMe-ChangeMe",
      "PASSWORD-PASSWORD-PASSWORD-PASSWORD-PASSWORD",
      "prod-secret-prod-secret-prod-secret-x",
      "TestTestTestTestTestTestTestTestTest",
    ]) {
      expect(checkAuthSecretStrength(weak)).toMatch(/弱密钥|强度不足/);
    }
  });

  it("拒绝单一重复字符与单调序列（无熵）", () => {
    expect(checkAuthSecretStrength("a".repeat(64))).toMatch(/强度不足/);
    expect(checkAuthSecretStrength("0".repeat(40))).toMatch(/强度不足/);
    expect(
      checkAuthSecretStrength("abcdefghijklmnopqrstuvwxyzabcdefgh"),
    ).toMatch(/强度不足/);
    expect(
      checkAuthSecretStrength("zyxwvutsrqponmlkjihgfedcbazyxwvuts"),
    ).toMatch(/强度不足/);
  });

  it("拒绝字符类过少的密钥", () => {
    expect(
      checkAuthSecretStrength("qwertyuiopasdfghjklzxcvbnmqwerty"),
    ).toMatch(/强度不足/);
  });

  it("接受随机生成的高熵密钥（base64url 形态，即推荐配置）", () => {
    expect(
      checkAuthSecretStrength(
        "kQ7v-Zm3Xp9LtR2sWn8Bc4Yd6Hj0Pa5Ue1Ig7Of3Nq9M",
      ),
    ).toBeNull();
    expect(
      checkAuthSecretStrength(
        "9f3Kx7Qw2Lm5Zt8Vb1Nc4Rdy6Hj0Pa2Sg6Uh8Wk3Ej5Tn",
      ),
    ).toBeNull();
  });

  it("生产环境下弱 AUTH_SECRET 必须 fail-fast（端到端复现攻击前置条件）", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "123";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    setValidRateLimitConfig();
    // 修复前：该配置会被放行 → 服务启动 → 弱密钥可被离线枚举 → 账号接管
    expect(() => validateProductionConfig()).toThrow(/AUTH_SECRET/);
  });

  it("生产环境下开发占位密钥必须 fail-fast", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "cyber-divination-dev-secret-change-me";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    setValidRateLimitConfig();
    expect(() => validateProductionConfig()).toThrow(/AUTH_SECRET/);
  });
});

/**
 * P0 数据完整性回归：生产禁止以本地 JSON 文件存分享快照。
 *
 * 原缺陷：`share/index.ts:20-27` driver 默认 `"local"`，而
 * `local-file.ts:26-45` 全量读改写且无文件锁；两套 env 校验器
 * （`validate-prod.ts`、`scripts/validate-prod-env.mjs`）都不读该变量。
 *
 * 故障场景：多实例并发写分享 → 后写覆盖前写 → 分享链接静默丢失/404；
 * 无持久盘部署重建后分享全部失效；且分享数据不在 Postgres 备份范围内。
 */
describe("isFileShareStoreForbiddenInProd（P0 修复回归）", () => {
  it("未设置 SHARE_STORE_DRIVER 时判定为禁止（默认落到 local）", () => {
    snapshotEnv();
    clearProdRelated();
    expect(isFileShareStoreForbiddenInProd()).toBe(true);
  });

  it("显式 local 判定为禁止", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.SHARE_STORE_DRIVER = "local";
    expect(isFileShareStoreForbiddenInProd()).toBe(true);
  });

  it("upstash 判定为允许", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.SHARE_STORE_DRIVER = "upstash";
    expect(isFileShareStoreForbiddenInProd()).toBe(false);
  });

  it("大小写与空白容忍", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.SHARE_STORE_DRIVER = "  UPSTASH  ";
    expect(isFileShareStoreForbiddenInProd()).toBe(false);
  });

  it("生产未配置分享存储时 fail-fast（复现静默丢数据的部署前置条件）", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.RATE_LIMIT_TRUSTED_PROXY = "0";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    // 修复前：该配置被放行 → 分享写本地文件 → 多实例并发互相覆盖
    expect(() => validateProductionConfig()).toThrow(/SHARE_STORE_DRIVER/);
  });

  it("生产显式 upstash 时通过", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DB_SKIP_ENSURE_SCHEMA = "1";
    setValidRateLimitConfig();
    expect(() => validateProductionConfig()).not.toThrow();
  });
});

/**
 * B2 回归：生产必须在部署前预跑 DDL，而不是在请求路径建表。
 *
 * 事实更正：交接提示词称「全项目 grep DB_SKIP_ENSURE_SCHEMA → 0 命中」，
 * 实际该开关自 T221 起就存在（`db/client.ts:52`）、`.env.example:65`、
 * `compose.production.yaml:40`、`compose.acceptance.yaml:45` 均已设置。
 * 真实缺口是**两套校验器都不读它**，非 compose 部署（standalone / PaaS）
 * 默认仍在请求路径执行 `CREATE TABLE`。
 */
describe("ensuresSchemaOnRequestPath（B2 修复回归）", () => {
  it("未配置 DATABASE_URL 时不视为请求期 DDL（回落 file 存储，另有校验拦截）", () => {
    snapshotEnv();
    clearProdRelated();
    expect(ensuresSchemaOnRequestPath()).toBe(false);
  });

  it("有 DATABASE_URL 且未设开关 → 仍会在请求路径建表", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    expect(ensuresSchemaOnRequestPath()).toBe(true);
  });

  it("开关为 1 时跳过；0 / 空串 / 空白不视为跳过", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    for (const v of ["0", "", "  "]) {
      process.env.DB_SKIP_ENSURE_SCHEMA = v;
      expect(ensuresSchemaOnRequestPath()).toBe(true);
    }
    process.env.DB_SKIP_ENSURE_SCHEMA = "1";
    expect(ensuresSchemaOnRequestPath()).toBe(false);
    restoreEnv();
  });

  it("生产 fail-fast：仅缺 DB_SKIP_ENSURE_SCHEMA 时抛错并给出迁移命令", () => {
    snapshotEnv();
    env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = STRONG_SECRET;
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    setValidRateLimitConfig();
    expect(() => validateProductionConfig()).toThrow(/DB_SKIP_ENSURE_SCHEMA/);
    try {
      validateProductionConfig();
    } catch (error) {
      expect(error instanceof Error ? error.message : "").toMatch(
        /db:migrate/,
      );
    }
  });
});

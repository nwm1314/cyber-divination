/**
 * V-1 独立复验：攻击性测试（尝试证伪 P0 修复结论）。
 *
 * 本文件由复验者独立编写，**不信任** FIX_REPORT 中的"已修复"声明，
 * 只相信亲手执行的证据。每个用例都是针对某项 P0 修复设计的反例/攻击。
 *
 * 注意：本文件为复验产物，如复验结论为"通过"，可保留作为长期回归守卫。
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  checkAuthSecretStrength,
  isFileShareStoreForbiddenInProd,
  validateProductionConfig,
} from "@/lib/config/validate-prod";
import { toSafeErrorMessage } from "@/lib/api/safe-error";
import { getLlmTimeoutMs } from "@/lib/reading/llm/client";

const env = process.env as Record<string, string | undefined>;

describe("V-1 复验 · P0-01 AUTH_SECRET 强度（尝试绕过）", () => {
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else env[k] = v;
    }
  });

  function snapshotProd() {
    for (const k of [
      "NODE_ENV",
      "AUTH_SECRET",
      "DATABASE_URL",
      "DB_SKIP_ENSURE_SCHEMA",
      "CLOUD_STORE_DRIVER",
      "RATE_LIMIT_DRIVER",
      "RATE_LIMIT_TRUSTED_PROXY",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "SHARE_STORE_DRIVER",
    ]) {
      saved[k] = process.env[k];
    }
    env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    // B2：生产必填，否则「强密钥必须放行」会被新增的 DDL 校验挡住
    process.env.DB_SKIP_ENSURE_SCHEMA = "1";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.RATE_LIMIT_TRUSTED_PROXY = "0";
    process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    process.env.SHARE_STORE_DRIVER = "upstash";
  }

  it("攻击1：用空格/换行填充长度的弱密钥必须被拒", () => {
    // 攻击者思路：校验只看 length，那就用空格凑够 32 位
    expect(checkAuthSecretStrength(" ".repeat(40))).toMatch(/必填|强度不足/);
    expect(checkAuthSecretStrength("x".repeat(40))).toMatch(/强度不足/);
    expect(checkAuthSecretStrength("\n".repeat(40))).toMatch(/必填/);
  });

  it("攻击2：用大小写变体绕过弱值字典必须被拒", () => {
    for (const v of [
      "CyBeR-DiViNaTiOn-DeV-SeCrEt-ChAnGe-Me",
      "SECRET-SECRET-SECRET-SECRET-SECRET12",
      "PaSsWoRd-PaSsWoRd-PaSsWoRd-PaSsWord",
    ]) {
      expect(checkAuthSecretStrength(v)).toMatch(/强度不足/);
    }
  });

  it("攻击3：用重复片段凑长度必须被拒", () => {
    expect(checkAuthSecretStrength("Ab1".repeat(12))).toMatch(/强度不足/);
    expect(checkAuthSecretStrength("xY9-".repeat(10))).toMatch(/强度不足/);
  });

  it("攻击4：生产路径端到端——所有弱密钥必须 fail-fast", () => {
    const weakCandidates = [
      "123",
      "changeme",
      "cyber-divination-dev-secret-change-me",
      "a".repeat(64),
      "abcdefghijklmnopqrstuvwxyz012345",
      "Ab1".repeat(11),
      "secret-".repeat(6),
    ];
    for (const w of weakCandidates) {
      snapshotProd();
      process.env.AUTH_SECRET = w;
      expect(
        () => validateProductionConfig(),
        `弱密钥应被拒绝: ${JSON.stringify(w)}`,
      ).toThrow(/AUTH_SECRET/);
    }
  });

  it("对照：强密钥在生产路径必须放行（防过度拦截）", () => {
    snapshotProd();
    process.env.AUTH_SECRET = "kQ7v-Zm3Xp9LtR2sWn8Bc4Yd6Hj0Pa5Ue1Ig7Of3Nq9M";
    expect(() => validateProductionConfig()).not.toThrow();
  });
});

describe("V-1 复验 · P0-02 分享存储（尝试绕过）", () => {
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else env[k] = v;
    }
  });

  it("攻击：所有非 upstash 取值都必须被判为禁止", () => {
    for (const v of [
      undefined,
      "",
      "   ",
      "local",
      "LOCAL",
      " local ",
      "file",
      "memory",
      "redis",
      "upstash2",
      "upstashx",
    ]) {
      if (v === undefined) delete process.env.SHARE_STORE_DRIVER;
      else process.env.SHARE_STORE_DRIVER = v;
      expect(
        isFileShareStoreForbiddenInProd(),
        `应判为禁止: ${JSON.stringify(v)}`,
      ).toBe(true);
    }
  });

  it("对照：仅 upstash（含大小写/空白）放行", () => {
    for (const v of ["upstash", "UPSTASH", "  UpStash  "]) {
      process.env.SHARE_STORE_DRIVER = v;
      expect(isFileShareStoreForbiddenInProd()).toBe(false);
    }
  });
});

describe("V-1 复验 · P0-03 错误脱敏（尝试让内部信息外泄）", () => {
  it("攻击：变换写法的驱动错误都必须被拦截", () => {
    const attacks = [
      'null value in column "name" violates not-null constraint',
      'duplicate key value violates unique constraint "people_pkey"',
      'relation "bazi_charts" does not exist',
      'invalid input syntax for type uuid: "abc"',
      "connect ECONNREFUSED ::1:5432",
      "PostgresError: column users.email does not exist",
      "at Object.upsertCloudPerson (/app/src/lib/storage/cloud-person-store.ts:113:9)",
      'insert or update on table "shares" violates foreign key constraint',
      "deadlock detected",
      "too many connections for role postgres",
      "password authentication failed for user app",
      "permission denied for table users",
    ];
    for (const a of attacks) {
      const r = toSafeErrorMessage(new Error(a), "保存失败，请稍后重试");
      expect(r, `必须拦截: ${a}`).toBe("保存失败，请稍后重试");
    }
  });

  it("攻击：通过构造短英文消息绕过（长度 <60 且无中文）", () => {
    // isTrustedBusinessMessage 要求含中文，故纯英文短消息应被拦
    expect(toSafeErrorMessage(new Error("ENOENT"), "保存失败")).toBe("保存失败");
    expect(toSafeErrorMessage(new Error("boom"), "保存失败")).toBe("保存失败");
  });

  it("攻击：以可信前缀开头但夹带 SQL 的混合消息", () => {
    const r = toSafeErrorMessage(
      new Error('请检查输入：null value in column "question" violates not-null constraint'),
      "保存失败",
    );
    expect(r).toBe("保存失败");
  });

  it("对照：正常业务中文消息必须原样返回（防过度拦截破坏用户体验）", () => {
    for (const good of [
      "缺少 Bazi 出生信息或有效命盘",
      "profile.id 与 chart.profileId 不一致",
      "请填写阳历或农历生日",
      "无效的 viewMode",
      "出生资料无法排盘",
    ]) {
      expect(toSafeErrorMessage(new Error(good), "兜底"), good).toBe(good);
    }
  });
});

describe("V-1 复验 · P0-06 LLM 超时（尝试证伪）", () => {
  it("攻击：超时值必须被强制为正有限数，不可被环境变量绕过", () => {
    const cases: [string, number][] = [
      ["0", 60000],
      ["-1", 60000],
      ["abc", 60000],
      ["", 60000],
      ["Infinity", 60000],
      ["NaN", 60000],
      ["1e10", 1e10], // 极大但对 Number.isFinite 成立，仍为正数（上游会拒绝而非静默无超时）
    ];
    for (const [input, expected] of cases) {
      process.env.LLM_TIMEOUT_MS = input;
      const got = getLlmTimeoutMs();
      if (input === "1e10") {
        expect(Number.isFinite(got)).toBe(true);
        expect(got).toBeGreaterThan(0);
      } else {
        expect(got, `LLM_TIMEOUT_MS=${input}`).toBe(expected);
      }
    }
    delete process.env.LLM_TIMEOUT_MS;
  });

  it("攻击：未设置时必须回落 60s（而非无超时）", () => {
    delete process.env.LLM_TIMEOUT_MS;
    expect(getLlmTimeoutMs()).toBe(60_000);
  });
});

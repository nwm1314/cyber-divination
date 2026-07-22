import { afterEach, describe, expect, it } from "vitest";
import {
  isFileCloudStoreForbiddenInProd,
  validateProductionConfig,
} from "./validate-prod";

const ENV_KEYS = [
  "NODE_ENV",
  "AUTH_SECRET",
  "AUTH_ALLOW_DEV_LOGIN",
  "CLOUD_STORE_DRIVER",
  "DATABASE_URL",
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
    else process.env[k] = v;
  }
}

function clearProdRelated() {
  delete process.env.AUTH_SECRET;
  delete process.env.AUTH_ALLOW_DEV_LOGIN;
  delete process.env.CLOUD_STORE_DRIVER;
  delete process.env.DATABASE_URL;
}

describe("validateProductionConfig（T302）", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("非 production 不校验", () => {
    snapshotEnv();
    process.env.NODE_ENV = "development";
    clearProdRelated();
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("生产缺 AUTH_SECRET 抛错", () => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    clearProdRelated();
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    expect(() => validateProductionConfig()).toThrow(/AUTH_SECRET/);
  });

  it("生产 AUTH_ALLOW_DEV_LOGIN=1 抛错", () => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "prod-secret";
    process.env.AUTH_ALLOW_DEV_LOGIN = "1";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    expect(() => validateProductionConfig()).toThrow(/AUTH_ALLOW_DEV_LOGIN/);
  });

  it("生产 file driver 抛错", () => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "prod-secret";
    process.env.CLOUD_STORE_DRIVER = "file";
    expect(() => validateProductionConfig()).toThrow(/file/);
  });

  it("生产无 DATABASE_URL 且未强制 postgres 时抛错（回落 file）", () => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "prod-secret";
    expect(() => validateProductionConfig()).toThrow(/file|DATABASE_URL/);
  });

  it("生产合法配置通过", () => {
    snapshotEnv();
    process.env.NODE_ENV = "production";
    clearProdRelated();
    process.env.AUTH_SECRET = "prod-secret";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    process.env.CLOUD_STORE_DRIVER = "postgres";
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it("isFileCloudStoreForbiddenInProd：postgres + DATABASE_URL 允许", () => {
    snapshotEnv();
    clearProdRelated();
    process.env.CLOUD_STORE_DRIVER = "postgres";
    process.env.DATABASE_URL = "postgres://u:p@localhost/db";
    expect(isFileCloudStoreForbiddenInProd()).toBe(false);
  });
});

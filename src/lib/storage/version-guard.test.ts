import { describe, expect, it } from "vitest";
import {
  assertVersionWritable,
  isVersionConflict,
  nextVersion,
  normalizeVersion,
  VersionConflictError,
} from "./version-guard";

describe("normalizeVersion（向后兼容旧行）", () => {
  it("缺省 / null / 非整数 / 负数都按 0", () => {
    for (const raw of [undefined, null, NaN, -1, 1.5, "3", {}, Number.POSITIVE_INFINITY]) {
      expect(normalizeVersion(raw)).toBe(0);
    }
  });

  it("合法整数版本原样返回", () => {
    expect(normalizeVersion(0)).toBe(0);
    expect(normalizeVersion(7)).toBe(7);
  });
});

describe("assertVersionWritable（B4 判定）", () => {
  const base = { resource: "person" as const, resourceId: "per_1" };

  it("不带 expectedVersion → 盲写放行，版本自增", () => {
    expect(assertVersionWritable({ ...base, storedVersion: 0, expectedVersion: undefined })).toBe(1);
    expect(assertVersionWritable({ ...base, storedVersion: 4, expectedVersion: undefined })).toBe(5);
  });

  it("旧行无版本视为 0，expected=0 可写", () => {
    expect(assertVersionWritable({ ...base, storedVersion: undefined, expectedVersion: 0 })).toBe(1);
  });

  it("版本落后 → 抛冲突，并带上双方版本号", () => {
    let caught: unknown;
    try {
      assertVersionWritable({ ...base, storedVersion: 3, expectedVersion: 1 });
    } catch (error) {
      caught = error;
    }
    expect(isVersionConflict(caught)).toBe(true);
    const error = caught as VersionConflictError;
    expect(error.code).toBe("STORAGE_VERSION_CONFLICT");
    expect(error.expectedVersion).toBe(1);
    expect(error.storedVersion).toBe(3);
    expect(error.message).toMatch(/并发冲突|刷新/);
    // 面向用户的文案不得泄露连接串/表结构
    expect(error.message).not.toMatch(/postgres|SELECT|INSERT/i);
  });

  it("expected 超前于 stored 同样拒绝（客户端状态不可能凭空更高）", () => {
    expect(() =>
      assertVersionWritable({ ...base, storedVersion: 2, expectedVersion: 9 }),
    ).toThrow(VersionConflictError);
  });

  it("resource 影响文案中的资源名", () => {
    expect(
      new VersionConflictError("chart", "p1", 0, 1).message,
    ).toMatch(/命盘/);
    expect(
      new VersionConflictError("person", "p1", 0, 1).message,
    ).toMatch(/人物档案/);
  });

  it("isVersionConflict 不误判普通错误", () => {
    expect(isVersionConflict(new Error("boom"))).toBe(false);
    expect(isVersionConflict(undefined)).toBe(false);
  });
});

describe("nextVersion", () => {
  it("对未知版本按 0 起算", () => {
    expect(nextVersion(undefined)).toBe(1);
    expect(nextVersion(9)).toBe(10);
  });
});

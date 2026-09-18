/**
 * V-1 复验发现的证据短板补充：P0-05 云端驱动判定一致性守护。
 *
 * 背景：`cloud-liuyao-store.ts` 的 `isPostgresDriver()` 曾多一个
 * `&& isDatabaseConfigured()`，与另三个 store 不一致，导致同一部署下
 * 三术数数据可能分裂到 Postgres 与 JSON 两个介质（导出/删号读到混合状态）。
 *
 * F-1 报告指出该 P0「0 新增测试，四份实现一致性无断言」。
 * 本测试用**源码文本比对**固化该一致性：任何一份实现被单独改动都会失败。
 *
 * 这是一种"源码级架构约束测试"——比运行时行为测试更直接地锁住不变量，
 * 因为该缺陷的本质就是"四份代码应当逐字符相同"。
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const STORES = [
  "src/lib/storage/cloud-store.ts",
  "src/lib/storage/cloud-ziwei-store.ts",
  "src/lib/storage/cloud-person-store.ts",
  "src/lib/storage/cloud-liuyao-store.ts",
] as const;

/** 提取 isPostgresDriver 函数体的归一化文本 */
function extractIsPostgresDriver(rel: string): string {
  const src = readFileSync(path.resolve(rel), "utf8");
  const m = src.match(
    /function isPostgresDriver\(\)[^{]*\{\s*([\s\S]*?)\n\}/,
  );
  if (!m) throw new Error(`未找到 isPostgresDriver：${rel}`);
  // 归一化空白，只比对语义内容
  return m[1].replace(/\s+/g, " ").trim();
}

describe("V-1 守护 · 四个云端 store 的 isPostgresDriver 必须逐字符一致", () => {
  it("四份实现语义完全一致", () => {
    const impls = STORES.map((s) => ({ file: s, body: extractIsPostgresDriver(s) }));
    const unique = new Set(impls.map((i) => i.body));
    expect(
      unique.size,
      `四份 isPostgresDriver 实现不一致：\n${impls
        .map((i) => `  ${i.file}: ${i.body}`)
        .join("\n")}`,
    ).toBe(1);
  });

  it("实现内容为 getCloudStoreDriver() === \"postgres\"（不带额外条件）", () => {
    for (const s of STORES) {
      const body = extractIsPostgresDriver(s);
      expect(body, s).toBe('return getCloudStoreDriver() === "postgres";');
      // 反向断言：不得再出现被移除的那个多余条件
      expect(body, `${s} 不应含 isDatabaseConfigured`).not.toContain(
        "isDatabaseConfigured",
      );
    }
  });

  it("driver.ts 在 postgres 无 DATABASE_URL 时 fail-fast（该冗余条件的替代保障）", () => {
    const driverSrc = readFileSync(
      path.resolve("src/lib/storage/driver.ts"),
      "utf8",
    );
    // 若 drive 层已保证 postgres ⇒ 数据库可用，则 store 层无需二次判断
    expect(driverSrc).toMatch(/CLOUD_STORE_DRIVER=postgres/);
    expect(driverSrc).toMatch(/禁止静默回落文件/);
    expect(driverSrc).toMatch(/throw new Error/);
  });
});

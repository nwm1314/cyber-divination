/**
 * auth 目录 server-only 边界守护（B16）
 *
 * 目的：会话密钥、Cookie 读取、SQL 用户表一旦被子组件间接引用，
 * 会把签名逻辑或 SQL 打进客户端 bundle。此处把「哪些模块必须是服务端专属」
 * 固化成断言，避免后续新增文件静默漏加。
 *
 * 约定：`types.ts` 是纯契约模块（无 SQL / secrets / fs / next-headers），
 * 允许客户端引用，因此**必须不加** server-only。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AUTH_DIR = path.resolve(__dirname);

function sourceOf(file: string): string {
  return readFileSync(path.join(AUTH_DIR, file), "utf8");
}

/** 含 SQL / 签名密钥 / 会话 Cookie 读取的模块：必须服务端专属 */
const SERVER_ONLY_REQUIRED = [
  "account.ts",
  "constants.ts",
  "get-session.ts",
  "index.ts",
  "magic-link.ts",
  "pg-users.ts",
  "session.ts",
  "users.ts",
];

describe("auth 目录 server-only 边界", () => {
  for (const file of SERVER_ONLY_REQUIRED) {
    it(`${file} 声明 server-only`, () => {
      expect(sourceOf(file)).toMatch(/^\s*import\s+["']server-only["']/m);
    });
  }

  it("types.ts 保持同构（不加 server-only，允许客户端引用契约类型）", () => {
    const src = sourceOf("types.ts");
    expect(src).not.toMatch(/["']server-only["']/);
    // 契约模块不得引入 Node / 数据库运行时
    expect(src).not.toMatch(/from\s+["'](crypto|node:crypto|postgres)["']/);
    expect(src).not.toMatch(/@\/lib\/db/);
  });
});

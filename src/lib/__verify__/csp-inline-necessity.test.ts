/**
 * CSP「为什么还留着 unsafe-inline」的可执行依据（B3）
 *
 * ## 实测（本轮，Next.js 16.2.10 生产 standalone + cacheComponents）
 * 把 script-src 收紧为 `'self'`（去掉 unsafe-inline）后，首页控制台报出
 * **9 条**「Refused to execute inline script」，且浏览器给出的建议哈希
 * **每条都不同** —— 因为内联脚本是 Next 按响应生成的 RSC flight payload
 * （`self.__next_f.push([...])`）与 `$RT/$RV` 引导码。
 * 于是两条常规出路都不成立：
 * - **nonce**：`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`
 *   明确写「Partial Prerendering (PPR) is incompatible with nonce-based CSP」，
 *   而本项目 `cacheComponents: true` 且 `npm run check:prerender` 要求静态路由 ≥15；
 *   用 nonce 等于全站转动态渲染，会同时推翻 P0-04 的修复成果。
 * - **构建期哈希 / SRI**：哈希随响应变化（见上），构建期算不出来。
 *
 * ## 本测试做什么
 * 不重复断言「策略里有 unsafe-inline」这种废话，而是把**成立条件**变成双向不变量：
 * 只要源码里还有动态 inline `style` 属性，`style-src` 就必须带 unsafe-inline；
 * 反过来，一旦有人把这些内联样式清掉，门禁会**要求**收紧 style-src。
 * script-src 的对应证据在构建产物里，由 `scripts/check-prerender-budget.mjs` 断言。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getContentSecurityPolicy } from "../../../next.config";

const ROOT = process.cwd();

/** ImageResponse 路由渲染的是图片而非 HTML 文档，不受 style-src 约束 */
const NON_HTML_FILES = /opengraph-image|image\.tsx$/;

async function collectInlineStyleSources(): Promise<string[]> {
  const hits: string[] = [];
  const stack = ["src"];
  while (stack.length) {
    const dir = stack.pop() as string;
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(rel);
        continue;
      }
      if (!/\.(tsx|jsx)$/.test(entry.name) || NON_HTML_FILES.test(entry.name)) {
        continue;
      }
      const text = await fs.readFile(path.join(ROOT, rel), "utf-8");
      if (/style=\{\{/.test(text)) hits.push(rel);
    }
  }
  return hits.sort();
}

function directive(csp: string, name: string): string {
  const found = csp.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name} `));
  return found ?? "";
}

describe("CSP inline 策略的成立条件（B3）", () => {
  const productionCsp = getContentSecurityPolicy(false);

  it("生产与开发策略都保留 unsafe-eval 的边界不变（仅开发）", () => {
    expect(directive(productionCsp, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(getContentSecurityPolicy(true), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("style-src 与「源码是否存在动态内联样式」保持一致（双向不变量）", async () => {
    const sources = await collectInlineStyleSources();
    const hasInlineStyles = sources.length > 0;
    const allowsInline = directive(productionCsp, "style-src").includes(
      "'unsafe-inline'",
    );

    if (hasInlineStyles) {
      expect(allowsInline).toBe(true);
    } else {
      // 内联样式已清空：此时保留 unsafe-inline 就是无谓的攻击面
      expect(
        allowsInline,
        "src 下已无 style={{ 写法，应从 style-src 移除 'unsafe-inline'",
      ).toBe(false);
    }
  });

  it("script-src 仍需要 unsafe-inline：前提是项目使用 cacheComponents（nonce 与 PPR 互斥）", async () => {
    const config = await fs.readFile(path.join(ROOT, "next.config.ts"), "utf-8");
    const usesPpr = /cacheComponents:\s*true/.test(config);
    const allowsInline = directive(productionCsp, "script-src").includes(
      "'unsafe-inline'",
    );

    expect(usesPpr).toBe(true);
    expect(allowsInline).toBe(true);
  });

  it("其余指令保持严格（未被放宽）", () => {
    expect(directive(productionCsp, "default-src")).toBe("default-src 'self'");
    expect(directive(productionCsp, "object-src")).toBe("object-src 'none'");
    expect(directive(productionCsp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(productionCsp, "form-action")).toBe("form-action 'self'");
    expect(directive(productionCsp, "frame-ancestors")).toBe(
      "frame-ancestors 'none'",
    );
    expect(productionCsp).not.toMatch(/\sscript-src\s[^;]*\*/);
    expect(productionCsp).not.toMatch(/\sconnect-src\s[^;]*https:/);
  });
});

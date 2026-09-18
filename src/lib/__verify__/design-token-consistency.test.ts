/**
 * V-1 复验发现的设计 token 一致性守护。
 *
 * 背景（真实回归）：P2 收口时把 `--shadow-glow-*` 下沉为 token，
 * 同时"清理死 token"误删了 `--shadow-glow-gold-lg` ——
 * 但 `src/app/page.tsx:63` 仍在引用它。由于 Tailwind 对**未定义**的
 * 自定义阴影类名不报错、只是不生成规则，结果是**首页卡片悬停光晕静默消失**
 * （原 `0 0 24px var(--gold-glow)`），且 lint/tsc/test 全绿无法发现。
 *
 * 本测试在**源码层面**同时约束两个方向：
 *   1. 被引用的 `shadow-glow-*` 类必须在 globals.css 中有同名 token 定义；
 *   2. 已定义的 token 不应完全无引用（避免再次误判"死 token"）。
 *
 * 这弥补了"CSS 类名拼写错误不会被任何现有门禁捕获"的空白。
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const GLOBALS = path.resolve("src/app/globals.css");

/** globals.css 中定义的 --shadow-<name> token 名集合 */
function definedShadowTokens(): Set<string> {
  const css = readFileSync(GLOBALS, "utf8");
  const names = new Set<string>();
  for (const m of css.matchAll(/--(shadow-[a-z0-9-]+)\s*:/g)) {
    names.add(m[1]);
  }
  return names;
}

/** 全项目（src/**）中被当作类名使用的 shadow-glow-* 集合 */
function usedShadowClasses(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  // git grep 避免扫描 node_modules/.next
  let raw = "";
  try {
    raw = execSync(
      'git grep -n "shadow-glow-" -- "src/**/*.tsx" "src/**/*.ts"',
      { encoding: "utf8" },
    );
  } catch {
    return out; // 无匹配时 git grep 退出码为 1
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [file, lineNo, ...rest] = line.split(":");
    const text = rest.join(":");
    for (const m of text.matchAll(/\bshadow-(glow-[a-z0-9-]+)\b/g)) {
      const name = `shadow-${m[1]}`;
      const list = out.get(name) ?? [];
      list.push(`${file}:${lineNo}`);
      out.set(name, list);
    }
  }
  return out;
}

describe("V-1 守护 · shadow token 定义与引用必须双向匹配", () => {
  it("每个被引用的 shadow-glow-* 类都必须有对应 token 定义", () => {
    const defined = definedShadowTokens();
    const used = usedShadowClasses();

    const missing: string[] = [];
    for (const [cls, locs] of used) {
      if (!defined.has(cls)) {
        missing.push(`${cls}  ← 被引用但未定义（${locs.join(", ")}）`);
      }
    }

    expect(
      missing,
      `以下 shadow token 被使用但未在 globals.css 定义，
Tailwind 不会为未定义的自定义阴影生成规则，效果是**视觉静默失效**：
  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("每个已定义的 shadow token 都应至少被引用一次（防再次误删）", () => {
    const defined = definedShadowTokens();
    const used = usedShadowClasses();

    const unused = [...defined].filter((t) => !used.has(t));

    expect(
      unused,
      `以下 shadow token 已定义但无任何引用。
若确认要删除，请先移除所有引用并同步更新本测试的预期；
不要仅因"看起来没人用"就删 —— 曾因此造成首页悬停光晕消失：
  ${unused.join("\n  ")}`,
    ).toEqual([]);
  });

  it("回归锚点：--shadow-glow-gold-lg 必须存在（曾被误删）", () => {
    expect(definedShadowTokens().has("shadow-glow-gold-lg")).toBe(true);
    expect([...usedShadowClasses().keys()]).toContain("shadow-glow-gold-lg");
  });
});

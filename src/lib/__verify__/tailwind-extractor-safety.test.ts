/**
 * Tailwind 提取器安全守护（第二轮 §11 修复的回归防线）
 *
 * ## 背景
 *
 * Tailwind v4 的静态提取器**会扫描项目内的 Markdown 与源码注释**，
 * 把其中形似工具类的文本当成真实类名。若文档或注释里写了
 * "方括号 + 通配符" 的任意值类名（例如阴影表达式的示例），
 * 提取器会生成**语法非法**的 CSS 规则
 * （方括号内含 `*`，PostCSS 报 `Unexpected token Delim('*')`），
 * 导致 dev server 与 e2e 环境**整站样式构建失败**。
 *
 * 本轮实测后果：`npx playwright test` 24 例全失败 → 修复后 11 例通过。
 *
 * ## 本测试的作用
 *
 * 用源码扫描**提前**发现此类字面量，把"构建/浏览器里才炸"的问题
 * 变成"单测即刻失败"。检查范围覆盖 docs/ 与 src/（即提取器的扫描面）。
 *
 * 判定规则：出现 `[` + 非空白字符 + `*` 的方括号片段即视为危险，
 * 因为 Tailwind 无法为含通配符的任意值生成合法 CSS。
 * 合法的具体值（如 `shadow-[0_0_8px_currentColor]`）不含 `*`，不受影响。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** 提取器会扫描的目录 */
const SCAN_DIRS = ["src", "docs"];

/** 跳过的路径（构建产物、依赖、本测试自身与其说明） */
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /[\\/]output[\\/]/,
  /\.git[\\/]/,
];

const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".md", ".mdx"]);

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (SKIP_PATTERNS.some((p) => p.test(rel))) continue;
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(rel)));
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * 危险模式：**Tailwind 工具类前缀** + `[`，且方括号内含通配符 `*`。
 *
 * 判定要点（避免误报）：
 * - 必须有已知的工具类前缀（w-/h-/shadow-/text-/bg-/p-/m-/gap- 等），
 *   否则 `majorByBranch[*]`（JSON 字段路径）会被误判；
 * - 前缀后紧邻 `[`（中间可无字符）；
 * - 方括号内必须含 `*`。
 *
 * 例：`shadow-[0_0_*px_var(--*-glow)]`、`w-[0_0_*px]`（危险）
 * 反例：`majorByBranch[*]`、`daxian[0..1]`、`shadow-[0_0_8px_currentColor]`（安全）
 *
 * 注：正则以「前缀 + 连字符结尾」匹配 `before` 串（`before` 不含 `[`），
 * 因此结尾写 `-` 而非 `-\[`。
 */
const UTILITY_PREFIX =
  /(?:^|[\s"'`:])(?:w|h|min-w|max-w|min-h|max-h|shadow|text|bg|border|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|inset|top|right|bottom|left|rounded|grid-cols|grid-rows|translate-x|translate-y|scale|opacity|z|leading|tracking|duration|delay|ease|aspect|basis|order|col-span|row-span|ring|outline|divide-x|divide-y)-$/;

function findDangerousMatches(content: string): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let start = line.indexOf("["); start !== -1; start = line.indexOf("[", start + 1)) {
      const end = line.indexOf("]", start + 1);
      if (end === -1) continue;
      const inner = line.slice(start + 1, end);
      if (!inner.includes("*")) continue;

      // 必须匹配「工具类前缀 + [」，且前缀紧邻方括号
      const before = line.slice(0, start);
      if (!UTILITY_PREFIX.test(before)) continue;

      hits.push({ line: i + 1, text: line.trim() });
      break; // 每行报一次即可
    }
  }
  return hits;
}

describe("Tailwind 提取器安全 · 禁止通配符任意值类名", () => {
  it("docs/ 与 src/ 中不存在方括号内含通配符的类名字面量", async () => {
    const files = (
      await Promise.all(SCAN_DIRS.map((d) => collectFiles(d)))
    ).flat();

    expect(files.length).toBeGreaterThan(50); // 扫描面有效性

    const offenders: string[] = [];
    for (const rel of files) {
      // 本测试文件自身包含用于说明的示例字面量，跳过以免自我命中
      if (rel.endsWith("tailwind-extractor-safety.test.ts")) continue;

      const content = await fs.readFile(path.join(ROOT, rel), "utf-8");
      const hits = findDangerousMatches(content);
      for (const h of hits) {
        offenders.push(`${rel}:${h.line}  ${h.text.slice(0, 120)}`);
      }
    }

    expect(
      offenders,
      `以下位置含方括号通配符类名字面量，会让 Tailwind 生成非法 CSS，` +
        `导致 dev/e2e 整站样式构建失败。请改写为文字描述或去掉通配符：\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("检测器自身有效：能识别危险样本、不误报字段路径", () => {
    // 危险样本：曾被 true 命中并导致 e2e 全站失败
    const bad = findDangerousMatches(
      'className="shadow-[0_0_' + '*px_var(--' + '*-glow)]"',
    );
    expect(bad.length).toBe(1);

    const bad2 = findDangerousMatches('className="w-[0_0_' + '*px]"');
    expect(bad2.length).toBe(1);

    // 安全样本：JSON 字段路径与具体值不应命中
    expect(findDangerousMatches('"majorByBranch[*]",')).toEqual([]);
    expect(findDangerousMatches("daxian[0..1].{startAge,endAge}")).toEqual([]);
    expect(
      findDangerousMatches('className="shadow-[0_0_8px_currentColor]"'),
    ).toEqual([]);
    expect(
      findDangerousMatches('className="shadow-[0_0_20px_var(--gold-glow)]"'),
    ).toEqual([]);
  });

  it("globals.css 的阴影 token 均被真实使用（防止误删导致视觉静默失效）", async () => {    const css = await fs.readFile(
      path.join(ROOT, "src/app/globals.css"),
      "utf-8",
    );
    // 提取 @theme 中定义的 --shadow-* token
    const defined = [...css.matchAll(/--(shadow-[a-z0-9-]+)\s*:/g)].map(
      (m) => m[1],
    );
    expect(defined.length).toBeGreaterThan(0);

    // 收集 src 下所有文件的类名引用面
    const srcFiles = await collectFiles("src");
    let usageText = "";
    for (const rel of srcFiles) {
      if (rel.endsWith("globals.css")) continue;
      usageText += await fs.readFile(path.join(ROOT, rel), "utf-8");
    }

    const unused = defined.filter((token) => !usageText.includes(token));
    expect(
      unused,
      `以下阴影 token 在 globals.css 中定义但全项目无引用（死 token）：\n` +
        unused.join("\n"),
    ).toEqual([]);
  });
});

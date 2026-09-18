/**
 * V-1 复验修正：六爻向导客户端 bundle 的**真实**边界。
 *
 * 背景（复验发现的定性偏差）：
 * commit `efaff81` 声称「六爻分析引擎已从客户端 bundle 剔除」。
 * V-1 复验按 `page_client-reference-manifest` 定位 `/liuyao/new` 的入口 chunk
 * 后做字节级扫描，发现：
 *   - **符号名**（`CATEGORY_YONGSHEN`/`YONGSHEN_RULES`/`inferQuestionCategory`）
 *     确实 0 命中 —— 该口径成立；
 *   - 但**规则表数据本身**（"求财"、"妻财" 等字符串）仍在入口 chunk 内
 *     （仅被压缩器重命名）。
 *
 * 根因：`CastForm` → `castLiuyao` → `cast/build.ts:16` 的
 * `import { enrichChart } from "../analyze"` 会反向拉入整个 `analyze/`。
 * 即 `CATEGORY_LABEL` 的解耦是**必要但不充分**的。
 *
 * 本测试固化**当前真实状态**，避免再次出现"以符号名 grep 冒充体积验证"的
 * 定性偏差。若将来真正完成服务端化拆分，本测试应随之更新为更强的断言。
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const CHUNK_DIR = path.resolve(".next/static/chunks");
const MANIFEST = path.resolve(
  ".next/server/app/liuyao/new/page_client-reference-manifest.js",
);

function readUtf8(p: string): string {
  return readFileSync(p, "utf8");
}

function allChunks(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...allChunks(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

/** 构建产物不存在时跳过（避免未构建环境误报） */
const built = existsSync(CHUNK_DIR) && existsSync(MANIFEST);

describe.skipIf(!built)("V-1 修正 · /liuyao/new 客户端 bundle 的真实内容", () => {
  it("符号名层面：CATEGORY_LABEL 解耦确实生效", () => {
    const manifest = readUtf8(MANIFEST);
    const entryChunks = allChunks(CHUNK_DIR).filter((c) =>
      manifest.includes(path.basename(c, ".js")),
    );
    expect(entryChunks.length).toBeGreaterThan(0);

    const symbols = [
      "CATEGORY_YONGSHEN",
      "YONGSHEN_RULES",
      "inferQuestionCategory",
      "resolveYongShenKind",
    ];
    for (const c of entryChunks) {
      const txt = readUtf8(c);
      for (const s of symbols) {
        expect(
          txt.includes(s),
          `${path.basename(c)} 不应包含引擎符号 ${s}`,
        ).toBe(false);
      }
    }
  });

  it("已知局限：用神规则表**数据**仍在入口 chunk（记录真实状态，非通过条件）", () => {
    const manifest = readUtf8(MANIFEST);
    const entryChunks = allChunks(CHUNK_DIR).filter((c) =>
      manifest.includes(path.basename(c, ".js")),
    );

    const withData = entryChunks.filter((c) => {
      const txt = readUtf8(c);
      return txt.includes("求财") && txt.includes("妻财");
    });

    // 该断言表达的是"现状如预期"：若将来完成拆分使 withData 变空，
    // 本测试会失败并提示更新 —— 这是**有意的**，用于记录边界变化。
    expect(
      withData.length,
      "用神规则表数据仍在 /liuyao/new 入口 chunk 中。\n" +
        "根因：cast/build.ts:16 的 `import { enrichChart } from \"../analyze\"`。\n" +
        "若已完成服务端化拆分，请将本断言更新为 toEqual([]) 并删除本条说明。",
    ).toBeGreaterThan(0);
  });

  it("enrichChart 的引入点确实在 cast 层（根因定位）", () => {
    const buildSrc = readFileSync(
      path.resolve("src/lib/liuyao/cast/build.ts"),
      "utf8",
    );
    expect(buildSrc).toMatch(
      /import\s*\{\s*enrichChart\s*\}\s*from\s*"\.\.\/analyze"/,
    );
  });
});

describe.skipIf(built)("V-1 修正 · 未构建时提示", () => {
  it("跳过 bundle 断言（需先 npm run build）", () => {
    expect(true).toBe(true);
  });
});

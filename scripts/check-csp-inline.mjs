/**
 * 构建后门禁：CSP 的 script-src 必须与「产物里是否真有内联脚本」一致（B3）。
 *
 * 为什么需要：本项目生产 CSP 目前保留 `script-src 'self' 'unsafe-inline'`。
 * 这不是疏忽，而是 Next.js 16 在 `cacheComponents`（PPR）下会为每个响应生成
 * 内联 flight 脚本（`self.__next_f.push(...)` 与 `$RT/$RV` 引导码）；实测去掉
 * unsafe-inline 后首页有 9 条内联脚本被浏览器拒绝，页面不再水合。
 *
 * 但「暂时去不掉」不等于「永远去不掉」。本脚本把它变成双向不变量：
 * - 产物里有内联脚本 → CSP 必须允许内联（否则站点是坏的）；
 * - 产物里没有内联脚本 → CSP 必须**不再**允许内联（此时它就是无谓的攻击面）。
 * 这样一旦 Next 改成外置这些脚本，门禁会立刻要求收紧，而不是留着一句过期注释。
 *
 * nonce 方案为何不采用：`node_modules/next/dist/docs/01-app/02-guides/
 * content-security-policy.md` 明确写着 nonce 与 PPR 互斥（静态外壳拿不到 nonce），
 * 采用 nonce 即等于全站动态渲染，会推翻 P0-04 并让 check:prerender 失败。
 *
 * 用法：npm run build && node scripts/check-csp-inline.mjs
 * 退出码：0 = 一致；1 = 不一致（配置坏掉，或应据此收紧/放宽）
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, ".next", "routes-manifest.json");
const APP_DIR = path.join(ROOT, ".next", "server", "app");

function fail(message) {
  console.error(`[check-csp] ${message}`);
  process.exit(1);
}

if (!existsSync(MANIFEST)) {
  fail("缺少 .next/routes-manifest.json，请先 npm run build");
}

function productionCsp() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));
  for (const rule of manifest.headers ?? []) {
    for (const header of rule.headers ?? []) {
      if (header.key?.toLowerCase() === "content-security-policy") {
        return String(header.value ?? "");
      }
    }
  }
  return "";
}

function walkHtml(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkHtml(full));
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

const csp = productionCsp();
if (!csp) fail("构建产物里没有 Content-Security-Policy 头");

const scriptSrc =
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src ")) ?? "";
const allowsInline = scriptSrc.includes("'unsafe-inline'");

const htmlFiles = walkHtml(APP_DIR);
if (htmlFiles.length === 0) {
  fail(`未在 ${path.relative(ROOT, APP_DIR)} 下找到预渲染 HTML，无法判定`);
}

let filesWithInline = 0;
let inlineTotal = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf-8");
  const count = (html.match(/<script(?![^>]*\bsrc=)/g) ?? []).length;
  if (count > 0) filesWithInline += 1;
  inlineTotal += count;
}

console.log(
  `[check-csp] 产物：${htmlFiles.length} 份 HTML，${filesWithInline} 份含内联脚本，共 ${inlineTotal} 个内联 script` +
    `；CSP script-src = "${scriptSrc}"`,
);

if (inlineTotal > 0 && !allowsInline) {
  fail(
    "产物含内联脚本但 CSP 不允许内联 → 页面不会水合（生产事故级）。" +
      "要么恢复 script-src 'unsafe-inline'，要么改用 nonce 并放弃 cacheComponents",
  );
}
if (inlineTotal === 0 && allowsInline) {
  fail(
    "产物已无内联脚本，但 CSP 仍留 script-src 'unsafe-inline' → 无谓攻击面，请收紧",
  );
}

console.log("[check-csp] 通过：CSP 与产物内联脚本状况一致");

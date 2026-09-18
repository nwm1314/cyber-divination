/**
 * 构建后门禁：断言静态预渲染路由数不低于阈值。
 *
 * 背景（V-1 复验发现的证据短板）：
 * P0-04 修复了「根布局读会话致全站动态渲染」，但 F-1 报告指出
 * 该修复「0 新增测试，『静态路由 ≥17』无 CI 门禁，回退到全站动态不会被拦截」。
 * 单元测试无法覆盖该不变量（它由构建产物决定），因此需要本脚本。
 *
 * 用法：
 *   npm run build && node scripts/check-prerender-budget.mjs
 *
 * 退出码：0 = 达标；1 = 静态路由数低于阈值（视为回归）
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * 阈值取实测值（17）略低一档（15），容忍合法的路由增删，
 * 但**任何大幅退化为"全站动态"都会被拦下**（回退到修复前是 2）。
 */
const MIN_STATIC_ROUTES = 15;

/** 必须保持静态化的关键公开路由（缺任何一个即视为回归） */
const REQUIRED_STATIC = [
  "/",
  "/privacy",
  "/settings",
  "/charts",
  "/ziwei",
  "/liuyao",
  "/people",
  "/account",
  "/auth/login",
  "/chart/new",
  "/ziwei/new",
  "/liuyao/new",
];

const manifestPath = path.resolve(".next/prerender-manifest.json");

if (!existsSync(manifestPath)) {
  console.error(
    "[check-prerender] 未找到 .next/prerender-manifest.json，请先执行 npm run build",
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const routes = Object.keys(manifest.routes ?? {}).sort();

const missing = REQUIRED_STATIC.filter((r) => !routes.includes(r));

const errors = [];
if (routes.length < MIN_STATIC_ROUTES) {
  errors.push(
    `静态路由数 ${routes.length} 低于阈值 ${MIN_STATIC_ROUTES}（修复前基线为 2，修复后为 17）`,
  );
}
if (missing.length > 0) {
  errors.push(`以下公开路由失去静态化：${missing.join(", ")}`);
}

if (errors.length > 0) {
  console.error("[check-prerender] 预渲染预算校验失败：");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    "\n提示：通常是根布局或其祖先重新引入了运行时 API（cookies/headers/searchParams），\n" +
      "或页面组件内直接 await 了未缓存数据。请将它们包进 <Suspense> 岛。",
  );
  process.exit(1);
}

console.log(
  `[check-prerender] 通过：静态路由 ${routes.length} 条（阈值 ${MIN_STATIC_ROUTES}）`,
);
console.log(`  ${routes.join(" ")}`);

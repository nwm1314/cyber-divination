import type { NextConfig } from "next";

const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * Keep the browser policy deliberately self-hosted. The browser talks only to
 * same-origin route handlers; the LLM, mail provider, and OG font fetches are
 * server-to-server connections and do not belong in connect-src.
 *
 * ## 为什么 script-src / style-src 仍带 'unsafe-inline'（B3，实测结论）
 * Next.js 16 在 `cacheComponents`（PPR）下会为**每个响应**生成内联脚本：
 * RSC flight payload（`self.__next_f.push([...])`）与 `$RT/$RV` 引导码。
 * 实测（16.2.10 生产 standalone）把 script-src 收紧为 `'self'` 后，首页控制台
 * 出现 9 条 "Refused to execute inline script"，且浏览器建议的 sha256 **每条都不同**
 * → 构建期哈希 / SRI 走不通。nonce 也不可行：Next 官方文档
 * `01-app/02-guides/content-security-policy.md` 明确 nonce 与 PPR 互斥
 * （静态外壳拿不到 nonce），改用 nonce 等于全站动态渲染，会推翻 P0-04 并让
 * `check:prerender` 门禁失败。
 * style-src 的原因是另一类：src 下的动态内联样式（`WuxingBars.tsx`、
 * `PalaceGrid.tsx` 按数据算宽度/格位）。
 *
 * 该结论不是「写完就忘」：`npm run check:csp`（构建后）与
 * `src/lib/__verify__/csp-inline-necessity.test.ts` 把它固化为双向不变量 ——
 * 一旦产物不再含内联脚本、或源码不再用内联样式，门禁会**要求**收紧。
 */
export function getContentSecurityPolicy(
  isDevelopment = process.env.NODE_ENV === "development",
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
  has?: Array<{ type: "header"; key: string; value: string }>;
};

/**
 * HSTS is matched on the transport assertion from the TLS terminator. This
 * prevents local HTTP development and an HTTP proxy hop from opting a browser
 * into HSTS, while still covering HTTPS behind the supported proxies.
 */
export function getSecurityHeaderRules(
  isProduction = process.env.NODE_ENV === "production",
): HeaderRule[] {
  const baseline = [
    { key: "Content-Security-Policy", value: getContentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-XSS-Protection", value: "0" },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  const rules: HeaderRule[] = [{ source: "/:path*", headers: baseline }];

  if (isProduction) {
    rules.push({
      source: "/:path*",
      has: [
        { type: "header", key: "x-forwarded-proto", value: "https" },
      ],
      headers: [
        { key: "Strict-Transport-Security", value: HSTS_VALUE },
      ],
    });
  }

  return rules;
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  /**
   * 启用 Cache Components（Next.js 16 的 PPR）。
   *
   * 背景：此前根布局直接 `await getServerSession()`（内部调用 `cookies()`），
   * 使全部 24 个页面退化为按请求 SSR，连首页/隐私政策这类纯静态页
   * 也无法被 CDN 缓存。修法是把会话读取下沉进 `<Suspense>` 包裹的
   * `HeaderSlot`；而在无 `cacheComponents` 的旧模型下，仅加 `<Suspense>`
   * 仍不足以产出静态外壳 —— 必须开启本开关，App Router 才会把
   * 「不使用运行时 API 的部分」预渲染为静态 shell，其余流式补入。
   *
   * 依据 `node_modules/next/dist/docs/.../cacheComponents.md`：
   * 「cacheComponents implements Partial Prerendering (PPR) as the default
   *  behavior in the App Router」。
   */
  cacheComponents: true,
  // Runtime data is created on the mounted volume or external stores.
  // Never package local users, magic links, charts, or shares into an image.
  outputFileTracingExcludes: {
    "/*": ["data/**/*"],
  },
  async headers() {
    return getSecurityHeaderRules();
  },
};

export default nextConfig;

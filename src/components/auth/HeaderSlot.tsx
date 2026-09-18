import { Suspense } from "react";
import { getServerSession } from "@/lib/auth/get-session";
import { AuthModeSync } from "./AuthModeSync";
import { SiteHeader } from "./SiteHeader";

/**
 * 会话依赖下沉（修复「根布局读会话导致全站动态渲染」）。
 *
 * 背景：`cookies()` 是 Next.js 运行时 API。此前根布局直接
 * `await getServerSession()`，使**所有**页面（含首页、隐私政策、
 * 公开分享页等纯静态页）失去静态预渲染资格，全部退化为按请求 SSR。
 *
 * 修法：把会话读取封进「头部岛」组件，并用 `<Suspense>` 包裹。
 * 静态外壳（无需会话的页面内容）仍可预渲染，只有头部 UI 在请求时流式补入。
 *
 * 依据 Next.js 16 文档 `01-app/01-getting-started/08-caching.md`
 * 「Components that access runtime APIs should be wrapped in `<Suspense>`」。
 *
 * 注意：此处**不可**用 `<Suspense fallback={null}>` 包住整个 `<body>` ——
 * 文档同章明确说明那会让整个应用推迟到请求时渲染，与目标相反。
 */

async function HeaderContent() {
  const session = await getServerSession();
  return (
    <>
      <AuthModeSync session={session} />
      <SiteHeader session={session} />
    </>
  );
}

/** 头部占位：高度与 SiteHeader 一致，避免流式补入时布局跳动 */
function HeaderFallback() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md"
      aria-hidden
    >
      <div className="safe-pad !py-2 !pb-2 flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
        <span className="text-sm tracking-[0.2em] text-gold uppercase shrink-0">
          赛博命理
        </span>
      </div>
    </header>
  );
}

export function HeaderSlot() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderContent />
    </Suspense>
  );
}

import Link from "next/link";
import type { AppSession } from "@/lib/types/user";
import { ARTS, BRAND } from "@/content/zh";
import { UserMenu } from "./UserMenu";

/**
 * 全局顶栏：品牌 + 三术数导航 + 登录态（T81 / T230）。
 *
 * 术数导航为 P1 修复：此前顶栏只有品牌与账号菜单，
 * 三个术数入口都只能从首页卡片或 /charts 的 pill 抵达，
 * 导致 /ziwei 与 /liuyao 列表页成为二级孤儿，
 * 且进入任一术数解读页后无法便捷切换到其它术数。
 *
 * 这里只在 `md` 及以上显示文字导航；移动端保留紧凑布局，
 * 术数入口仍可从首页卡片与档案页 pill 抵达。
 */
export function SiteHeader({ session }: { session: AppSession }) {
  const liveArts = ARTS.filter((art) => art.status === "live" && art.href);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="safe-pad !py-2 !pb-2 flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/"
            className="text-sm tracking-[0.2em] text-gold uppercase hover:brightness-110 transition-all shrink-0"
          >
            {BRAND.name}
          </Link>
          <nav aria-label="术数导航" className="hidden md:flex items-center gap-3">
            {liveArts.map((art) => (
              <Link
                key={art.key}
                href={art.href!}
                className="text-xs text-muted hover:text-cyan transition-colors whitespace-nowrap"
              >
                {art.name}
              </Link>
            ))}
            <Link
              href="/charts"
              className="text-xs text-muted hover:text-cyan transition-colors whitespace-nowrap"
            >
              档案
            </Link>
          </nav>
        </div>
        <UserMenu initialSession={session} />
      </div>
    </header>
  );
}

import Link from "next/link";
import type { AppSession } from "@/lib/types/user";
import { BRAND } from "@/content/zh";
import { UserMenu } from "./UserMenu";

/** 全局顶栏：品牌 + 登录态（T81 / T230） */
export function SiteHeader({ session }: { session: AppSession }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="safe-pad !py-2 !pb-2 flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
        <Link
          href="/"
          className="text-sm tracking-[0.2em] text-gold uppercase hover:brightness-110 transition-all shrink-0"
        >
          {BRAND.name}
        </Link>
        <UserMenu initialSession={session} />
      </div>
    </header>
  );
}

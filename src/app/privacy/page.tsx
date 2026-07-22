import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import {
  PRIVACY_SECTIONS,
  PRIVACY_TITLE,
  PRIVACY_UPDATED,
} from "@/content/privacy";

export const metadata: Metadata = {
  title: "隐私政策 · 赛博命理",
  description:
    "赛博命理隐私政策：本地数据、云端账号、LLM 解读与分享链接说明。",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-10">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 首页
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            {PRIVACY_TITLE}
          </h1>
          <Link
            href="/account"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            账号
          </Link>
        </header>

        <p className="text-xs text-muted text-center sm:text-left">
          最近更新：{PRIVACY_UPDATED} · 未登录亦可阅读本页
        </p>

        <div className="space-y-4">
          {PRIVACY_SECTIONS.map((sec) => (
            <Card key={sec.id} title={sec.title} id={sec.id}>
              <div className="space-y-3">
                {sec.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-sm text-muted leading-relaxed"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <footer className="pt-2 text-center text-xs text-muted space-x-3">
          <Link href="/settings" className="hover:text-cyan transition-colors">
            本地设置
          </Link>
          <span aria-hidden>·</span>
          <Link href="/account" className="hover:text-cyan transition-colors">
            账号与数据
          </Link>
        </footer>
      </div>
    </div>
  );
}

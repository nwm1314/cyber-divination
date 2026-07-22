import Link from "next/link";
import { CastForm } from "@/components/liuyao";

export const metadata = {
  title: "六爻起卦 · 赛博命理",
  description:
    "一事一问：铜钱、时间或手动起卦；确定性装卦，解卦可选模板/LLM",
};

export default function LiuyaoNewPage() {
  return (
    <div className="flex flex-1 flex-col cyber-grid">
      <div className="safe-pad flex flex-1 flex-col items-center">
        <header className="w-full max-w-lg pt-2 pb-4 flex items-center justify-between gap-3">
          <Link
            href="/liuyao"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 历史
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            六爻起卦
          </h1>
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            首页
          </Link>
        </header>
        <main className="w-full max-w-lg flex-1 pb-8">
          <p className="text-sm text-muted mb-5 leading-relaxed">
            针对<strong className="text-foreground/80 font-medium">一次所问</strong>
            起卦，非终身命盘。装卦由本地确定性引擎完成（不经
            LLM）；解卦报告可另选模板或 LLM。请先写清事项，再选起卦方式。
          </p>
          <CastForm />
        </main>
      </div>
    </div>
  );
}

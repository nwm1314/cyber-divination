import Link from "next/link";
import { BirthWizard } from "@/components/form";

export const metadata = {
  title: "新建命盘 · 赛博八字 · 赛博命理",
  description:
    "引导式采集出生信息；确定性引擎排盘（不经 LLM），解读可选模板或 LLM",
};

export default function ChartNewPage() {
  return (
    <div className="flex flex-1 flex-col cyber-grid">
      <div className="safe-pad flex flex-1 flex-col items-center">
        <header className="w-full max-w-lg pt-2 pb-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 返回
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            新建命盘
          </h1>
          <span className="w-10" aria-hidden />
        </header>
        <main className="w-full max-w-lg flex-1 pb-8">
          <p className="text-sm text-muted mb-5 leading-relaxed">
            按步骤填写信息（姓名 → 生日 → 时辰 → 性别地点 → 在世与基准 →
            确认）。时辰可跳过；确认后可回改。确认后由本地确定性引擎排盘（不经
            LLM）；解读报告可另选模板或 LLM。
          </p>
          <BirthWizard />
        </main>
      </div>
    </div>
  );
}

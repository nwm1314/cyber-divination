import Link from "next/link";
import { ZiweiWizard } from "@/components/ziwei";

export const metadata = {
  title: "新建紫微盘 · 赛博命理",
  description: "采集生辰信息，确定性排紫微十二宫与主星",
};

export default function ZiweiNewPage() {
  return (
    <div className="flex flex-1 flex-col cyber-grid">
      <div className="safe-pad flex flex-1 flex-col items-center">
        <header className="w-full max-w-lg pt-2 pb-4 flex items-center justify-between gap-3">
          <Link
            href="/ziwei"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 列表
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            新建紫微盘
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
            按步骤填写生辰（姓名 → 生日 → 时辰 → 性别地点 →
            确认）。确认后本地确定性引擎排盘（不经 LLM）；解读报告可另选模板或
            LLM。
          </p>
          <ZiweiWizard />
        </main>
      </div>
    </div>
  );
}

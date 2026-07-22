import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareSnapshot } from "@/lib/share";
import { Disclaimer } from "@/components/Disclaimer";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await getShareSnapshot(token);
  if (!snapshot || (snapshot.kind && snapshot.kind !== "liuyao")) {
    return { title: "分享不存在 · 赛博六爻" };
  }
  return {
    title: `${snapshot.chartName} · 六爻分享`,
    description: snapshot.advice?.slice(0, 80) || "六爻一事一问分享",
  };
}

export default async function LiuyaoSharePage({ params }: Props) {
  const { token } = await params;
  const snapshot = await getShareSnapshot(token);
  if (!snapshot || (snapshot.kind && snapshot.kind !== "liuyao") || !snapshot.liuyao) {
    notFound();
  }

  const ly = snapshot.liuyao;

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full gap-5 pb-10 pt-4">
        <header className="text-center space-y-1">
          <p className="text-xs text-muted tracking-widest">赛博六爻 · 只读分享</p>
          <h1 className="text-lg font-bold text-gold tracking-wide">
            {snapshot.chartName}
          </h1>
        </header>

        <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-3">
          <p className="text-sm">
            <span className="text-muted text-xs block mb-0.5">所问</span>
            {ly.question}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted text-xs block">本卦</span>
              <span className="text-gold font-medium">{ly.benGuaName}</span>
            </div>
            {ly.bianGuaName && (
              <div>
                <span className="text-muted text-xs block">变卦</span>
                <span className="text-cyan font-medium">{ly.bianGuaName}</span>
              </div>
            )}
            {ly.yongShen && (
              <div>
                <span className="text-muted text-xs block">用神</span>
                {ly.yongShen}
              </div>
            )}
            <div>
              <span className="text-muted text-xs block">起卦</span>
              {ly.method}
            </div>
          </div>
          <p className="text-sm text-foreground/90 border-t border-border/60 pt-3">
            {snapshot.advice}
          </p>
        </div>

        <p className="text-[10px] text-muted/60 text-center leading-relaxed">
          装卦为本地确定性引擎（不经 LLM）；签语/解卦可为规则模板或 LLM。
        </p>
        <Disclaimer text={snapshot.disclaimer} />

        <div className="flex justify-center gap-4 text-sm">
          <Link href="/liuyao/new" className="text-cyan hover:text-gold">
            去起卦
          </Link>
          <Link href="/" className="text-muted hover:text-foreground">
            首页
          </Link>
        </div>
      </div>
    </div>
  );
}

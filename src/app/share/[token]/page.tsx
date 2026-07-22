import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShareSnapshot } from "@/lib/share";
import { ShareCard } from "@/components/share";
import { DisclaimerFooter } from "@/components/reading";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await getShareSnapshot(token);

  if (
    !snapshot ||
    snapshot.kind === "ziwei" ||
    snapshot.kind === "liuyao"
  ) {
    return {
      title: "分享不存在 · 赛博八字",
      description: "该命盘分享链接无效或已过期。",
      robots: { index: false, follow: false },
    };
  }

  const title = `${snapshot.chartName} · 赛博八字命盘`;
  const description =
    snapshot.advice?.slice(0, 120) ||
    `日主${snapshot.dayMaster ?? ""} · 命理分析仅供参考`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      siteName: "赛博八字",
      // opengraph-image.tsx 会自动挂到此路由；显式 meta 由 Next 注入
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const snapshot = await getShareSnapshot(token);

  if (
    !snapshot ||
    snapshot.kind === "ziwei" ||
    snapshot.kind === "liuyao" ||
    !snapshot.pillars
  ) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-dvh cyber-grid">
      <div className="safe-pad flex flex-col max-w-2xl mx-auto w-full gap-6 pb-8">
        <header className="text-center pt-4">
          <h1 className="text-xl font-bold tracking-wider text-gold">
            赛博八字
          </h1>
          <p className="text-xs text-muted mt-1">命盘分享</p>
        </header>

        <ShareCard
          pillars={snapshot.pillars}
          dayMaster={snapshot.dayMaster ?? "—"}
          advice={snapshot.advice}
          chartName={snapshot.chartName}
        />

        <p className="text-[10px] text-muted/60 text-center leading-relaxed">
          排盘为本地确定性引擎（不经 LLM）；签语/解读可为规则模板或 LLM。
        </p>
        <DisclaimerFooter text={snapshot.disclaimer} />
      </div>
    </div>
  );
}

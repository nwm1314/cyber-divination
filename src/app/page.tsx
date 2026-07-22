import Link from "next/link";
import { Card } from "@/components/ui";
import { Disclaimer } from "@/components/Disclaimer";
import { ARTS, BRAND, HOME, type ArtEntry } from "@/content/zh";

function ArtCard({ art }: { art: ArtEntry }) {
  const live = art.status === "live" && art.href;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] tracking-widest text-muted uppercase mb-0.5">
            {art.product}
          </p>
          <h3
            className={[
              "text-xl font-semibold tracking-wide",
              live ? "text-gold" : "text-muted",
            ].join(" ")}
          >
            {art.name}
          </h3>
        </div>
        {live ? (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-cyan/35 bg-cyan/10 text-cyan">
            可用
          </span>
        ) : (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-border text-muted">
            {HOME.comingSoon}
          </span>
        )}
      </div>
      <p
        className={[
          "text-xs leading-relaxed mb-4 min-h-[2.5rem]",
          live ? "text-muted" : "text-muted/60",
        ].join(" ")}
      >
        {art.description}
      </p>
      <span
        className={[
          "inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-all",
          live
            ? "bg-gold/15 text-gold border border-gold/40 group-hover:bg-gold group-hover:text-background group-hover:shadow-[0_0_16px_var(--gold-glow)]"
            : "bg-surface-elevated text-muted/50 border border-border cursor-not-allowed",
        ].join(" ")}
      >
        {live ? art.cta : HOME.comingSoon}
      </span>
    </>
  );

  if (live) {
    return (
      <Link
        href={art.href!}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
      >
        <Card
          className="!p-4 h-full border-gold/20 group-hover:border-gold/45 group-hover:shadow-[0_0_24px_var(--gold-glow)] transition-all"
          glow="none"
        >
          {body}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      className="!p-4 h-full opacity-55 grayscale-[0.35]"
      aria-disabled="true"
    >
      {body}
    </Card>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col cyber-grid">
      <div className="safe-pad flex flex-1 flex-col items-center">
        <main className="w-full max-w-3xl flex-1 flex flex-col justify-center gap-8 py-6 sm:py-8">
          <div className="space-y-4 text-center sm:text-left">
            <p className="text-cyan text-sm tracking-widest">
              {BRAND.tagline}
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight">
              <span className="text-foreground">{BRAND.heroLead}</span>
              <br />
              <span className="text-gold">{BRAND.heroAccent}</span>
            </h1>
            <p className="text-muted text-base sm:text-lg max-w-xl mx-auto sm:mx-0 leading-relaxed">
              {BRAND.heroDesc}
            </p>
          </div>

          <section aria-labelledby="arts-heading" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
              <h2
                id="arts-heading"
                className="text-sm font-medium tracking-widest text-gold"
              >
                {HOME.artsTitle}
              </h2>
              <p className="text-[11px] text-muted">{HOME.artsSubtitle}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {ARTS.map((art) => (
                <ArtCard key={art.key} art={art} />
              ))}
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Link
              href="/people"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium border border-gold/40 text-gold hover:bg-gold/10 transition-all w-full sm:w-auto"
            >
              人物档案
            </Link>
            <Link
              href="/charts"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium border border-cyan/40 text-cyan hover:bg-cyan/10 transition-all w-full sm:w-auto"
            >
              {HOME.archives}
            </Link>
            <Link
              href="/settings"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium border border-border text-muted hover:text-foreground hover:border-gold/40 transition-all w-full sm:w-auto"
            >
              {HOME.settings}
            </Link>
            <p className="text-xs text-muted sm:max-w-xs">
              {BRAND.secondaryHint}
            </p>
          </div>

          <Card
            className="border-gold/20"
            title="免责声明"
            subtitle="请在使用前阅读"
          >
            <Disclaimer />
          </Card>
        </main>

        <footer className="w-full max-w-3xl py-6 text-center text-xs text-muted space-x-3">
          <span>{BRAND.footer}</span>
          <Link href="/privacy" className="hover:text-cyan transition-colors">
            隐私政策
          </Link>
          <Link href="/account" className="hover:text-cyan transition-colors">
            账号
          </Link>
        </footer>
      </div>
    </div>
  );
}

import type { BaziChart } from "@/lib/types";
import { BaziTable } from "@/components/chart/BaziTable";

type Props = {
  pillars: BaziChart["pillars"];
  dayMaster: string;
  advice: string;
  chartName: string;
};

export function ShareCard({ pillars, dayMaster, advice, chartName }: Props) {
  return (
    <div className="rounded-xl bg-surface/90 backdrop-blur-sm border neon-border p-5 sm:p-6">
      <div className="text-center mb-4">
        <h2 className="text-base font-bold tracking-wider text-gold">
          {chartName}
        </h2>
        <p className="text-[10px] text-muted/50 mt-0.5">赛博八字 · 命盘分享</p>
      </div>

      <BaziTable pillars={pillars} dayMaster={dayMaster} />

      {advice && (
        <div className="mt-5 pt-4 border-t border-border/40">
          <p className="text-xs font-medium text-gold mb-2 tracking-wide">
            签语
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">{advice}</p>
        </div>
      )}
    </div>
  );
}

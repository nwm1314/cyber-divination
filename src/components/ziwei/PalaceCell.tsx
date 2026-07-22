import type { ZiweiPalace } from "@/lib/types/ziwei";
import { StarBadge } from "./StarBadge";

type Props = {
  palace: ZiweiPalace;
  isMing?: boolean;
  className?: string;
};

export function PalaceCell({ palace, isMing, className = "" }: Props) {
  const majors = palace.stars.filter((s) => s.category === "major");
  const others = palace.stars.filter((s) => s.category !== "major");

  return (
    <div
      className={[
        "relative flex flex-col min-h-[4.5rem] sm:min-h-[5.5rem] p-1.5 sm:p-2",
        "border border-border/80 bg-surface/80",
        isMing ? "ring-1 ring-inset ring-gold/50 bg-gold/5" : "",
        palace.isShenGong ? "shadow-[inset_0_0_20px_var(--cyan-glow)]" : "",
        className,
      ].join(" ")}
      data-palace={palace.name}
      data-branch={palace.branch}
    >
      <div className="flex items-start justify-between gap-0.5 mb-1">
        <div className="flex flex-col min-w-0">
          <span
            className={[
              "text-[10px] sm:text-xs font-semibold truncate",
              isMing ? "text-gold" : "text-foreground/90",
            ].join(" ")}
          >
            {palace.name}
            {isMing ? (
              <span className="ml-0.5 text-[9px] text-gold/80">命</span>
            ) : null}
            {palace.isShenGong ? (
              <span className="ml-0.5 text-[9px] text-cyan">身</span>
            ) : null}
          </span>
          <span className="text-[9px] sm:text-[10px] text-muted font-mono">
            {palace.stem ?? ""}
            {palace.branch}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-0.5 content-start flex-1">
        {majors.map((s) => (
          <StarBadge key={s.name} star={s} />
        ))}
        {others.map((s) => (
          <StarBadge key={s.name} star={s} />
        ))}
        {palace.stars.length === 0 ? (
          <span className="text-[9px] text-muted/50">—</span>
        ) : null}
      </div>
    </div>
  );
}

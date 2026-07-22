import type { ZiweiStar } from "@/lib/types/ziwei";

const CATEGORY_CLASS: Record<string, string> = {
  major:
    "border-gold/50 bg-gold/15 text-gold shadow-[0_0_8px_var(--gold-glow)]",
  soft: "border-cyan/40 bg-cyan/10 text-cyan",
  harsh: "border-danger/40 bg-danger/10 text-danger",
  misc: "border-border bg-surface-elevated text-muted",
};

type Props = {
  star: ZiweiStar;
  size?: "sm" | "md";
};

export function StarBadge({ star, size = "sm" }: Props) {
  const cat = star.category ?? "misc";
  const cls = CATEGORY_CLASS[cat] ?? CATEGORY_CLASS.misc;
  const sizeCls =
    size === "md"
      ? "text-xs px-2 py-0.5"
      : "text-[10px] sm:text-[11px] px-1.5 py-0.5";

  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded border font-medium tracking-wide",
        sizeCls,
        cls,
      ].join(" ")}
      title={[
        star.name,
        star.brightness ? `亮度·${star.brightness}` : "",
        star.sihua?.length ? `四化·${star.sihua.join("")}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {star.name}
      {star.brightness ? (
        <span className="opacity-70 font-normal">{star.brightness}</span>
      ) : null}
      {star.sihua?.map((s) => (
        <span key={s} className="text-cyan opacity-90">
          {s}
        </span>
      ))}
    </span>
  );
}

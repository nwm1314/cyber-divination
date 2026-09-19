import type { ZiweiStar } from "@/lib/types/ziwei";

const CATEGORY_CLASS: Record<string, string> = {
  major:
    "border-gold/50 bg-gold/15 text-gold shadow-glow-gold-sm",
  soft: "border-cyan/40 bg-cyan/10 text-cyan",
  harsh: "border-danger/40 bg-danger/10 text-danger",
  misc: "border-border bg-surface-elevated text-muted",
};

type Props = {
  star: ZiweiStar;
  size?: "sm" | "md";
};

/**
 * 星曜类别的中文标签。
 *
 * 修复（P2 A3）：类别此前**仅靠颜色**区分（主星=金 / 吉星=青 / 煞星=红），
 * 色盲用户与屏幕阅读器都无法获知，且整个徽章 aria/role 命中为 0。
 * 现把类别写入无障碍名称，并由 aria-label 汇总全部语义。
 */
const CATEGORY_LABEL: Record<string, string> = {
  major: "主星",
  soft: "吉星",
  harsh: "煞星",
  misc: "杂曜",
};

export function StarBadge({ star, size = "sm" }: Props) {
  const cat = star.category ?? "misc";
  const cls = CATEGORY_CLASS[cat] ?? CATEGORY_CLASS.misc;
  const sizeCls =
    size === "md"
      ? "text-xs px-2 py-0.5"
      : "text-[10px] sm:text-[11px] px-1.5 py-0.5";

  const categoryLabel = CATEGORY_LABEL[cat] ?? CATEGORY_LABEL.misc;
  const accessibleName = [
    `${star.name}（${categoryLabel}）`,
    star.brightness ? `亮度${star.brightness}` : "",
    star.sihua?.length ? `四化${star.sihua.join("")}` : "",
  ]
    .filter(Boolean)
    .join("，");

  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded border font-medium tracking-wide",
        sizeCls,
        cls,
      ].join(" ")}
      aria-label={accessibleName}
      title={[
        star.name,
        star.brightness ? `亮度·${star.brightness}` : "",
        star.sihua?.length ? `四化·${star.sihua.join("")}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
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
    </span>
  );
}

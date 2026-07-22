import type { ViewMode } from "@/lib/types";

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "plain", label: "通俗" },
  { value: "pro", label: "专业" },
];

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-border overflow-hidden"
      role="tablist"
      aria-label="通俗/专业模式"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-gold text-background shadow-[inset_0_0_8px_var(--gold-glow)]"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

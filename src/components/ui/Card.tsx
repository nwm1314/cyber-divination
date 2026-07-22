import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  glow?: "gold" | "cyan" | "none";
};

export function Card({
  children,
  title,
  subtitle,
  glow = "none",
  className = "",
  ...rest
}: CardProps) {
  const glowClass =
    glow === "gold"
      ? "shadow-[0_0_32px_var(--gold-glow)] border-gold/25"
      : glow === "cyan"
        ? "shadow-[0_0_32px_var(--cyan-glow)] border-cyan/25"
        : "border-border";

  return (
    <div
      className={[
        "rounded-xl bg-surface/90 backdrop-blur-sm border neon-border p-5 sm:p-6",
        glowClass,
        className,
      ].join(" ")}
      {...rest}
    >
      {(title || subtitle) && (
        <header className="mb-4 space-y-1">
          {title ? (
            <h2 className="text-lg font-semibold tracking-wide text-gold">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-muted leading-relaxed">{subtitle}</p>
          ) : null}
        </header>
      )}
      {children}
    </div>
  );
}

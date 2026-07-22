import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-gold text-background hover:brightness-110 shadow-[0_0_20px_var(--gold-glow)] border border-gold-dim",
  secondary:
    "bg-surface-elevated text-cyan border border-cyan/40 hover:bg-cyan/10 shadow-[0_0_16px_var(--cyan-glow)]",
  ghost:
    "bg-transparent text-foreground border border-border hover:border-gold/50 hover:text-gold",
  danger:
    "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium transition-all",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
        "disabled:opacity-45 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

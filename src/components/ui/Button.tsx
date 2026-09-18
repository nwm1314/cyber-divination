import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /**
   * 加载中：禁用交互并显示 spinner + 可访问的忙碌状态。
   *
   * 补此 prop 的原因：全项目多处按钮是「busy 时 disabled」的写法
   * （如 charts/page.tsx 的同步按钮、AccountPanel 的导出/删除），
   * 但都缺少视觉与语义上的加载指示，用户不知道操作是否在进行中。
   */
  loading?: boolean;
  /** 加载中的可见文案（默认沿用 children，仅额外显示 spinner） */
  loadingText?: string;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-gold text-background hover:brightness-110 shadow-[0_0_20px_var(--gold-glow)] border border-gold-dim",
  secondary:
    "bg-surface-elevated text-cyan border border-cyan/40 hover:bg-cyan/10 shadow-glow-cyan",
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
  loading = false,
  loadingText,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
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
      {loading ? (
        <>
          <span
            className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden
          />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

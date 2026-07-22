"use client";

import {
  useId,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
} from "react";

const FORM_CONTROL_TYPES = new Set(["input", "select", "textarea"]);

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy =
    [error ? errorId : null, hint && !error ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const isFormControl =
    isValidElement(children) &&
    typeof children.type === "string" &&
    FORM_CONTROL_TYPES.has(children.type);

  const enhanced = isFormControl
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <label className="flex flex-col gap-1.5 w-full">
      <span className="text-sm text-foreground/90">
        {label}
        {required ? (
          <span className="text-gold ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">（必填）</span> : null}
      </span>
      {enhanced}
      {hint && !error ? (
        <span id={hintId} className="text-xs text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full h-11 px-3 rounded-lg bg-surface-elevated border border-border text-foreground placeholder:text-muted/70 focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/40";

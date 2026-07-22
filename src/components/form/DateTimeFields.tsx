"use client";

import { useId, useRef } from "react";
import { Field, inputClass } from "./Field";

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
};

/** 阳历：可手输 YYYY-MM-DD，也可点右侧日历 */
export function SolarDateField({
  label,
  value,
  onChange,
  required,
  error,
  hint,
}: DateFieldProps) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);

  return (
    <Field
      label={label}
      required={required}
      error={error}
      hint={hint ?? "可直接输入如 1990-05-15，或点右侧日历选择"}
    >
      <div className="flex gap-2 items-stretch">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(normalizeDateInput(e.target.value))}
          placeholder="1990-05-15"
          maxLength={10}
          aria-invalid={error ? true : undefined}
          aria-label={label}
        />
        <button
          type="button"
          className="shrink-0 h-11 px-3 rounded-lg border border-border bg-surface-elevated text-cyan text-sm hover:border-cyan/50 transition-colors"
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker?.();
            } catch {
              el.click();
            }
          }}
          aria-label="打开日期选择器"
        >
          日历
        </button>
        <input
          ref={pickerRef}
          type="date"
          className="sr-only"
          tabIndex={-1}
          value={isValidIsoDate(value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-hidden
        />
      </div>
    </Field>
  );
}

type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
};

/** 时间：可手输 HH:mm，也可点右侧时钟 */
export function BirthTimeField({
  label,
  value,
  onChange,
  disabled,
  hint,
  error,
}: TimeFieldProps) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);

  return (
    <Field
      label={label}
      error={error}
      hint={hint ?? "可直接输入如 14:30，或点右侧时钟选择；未知可勾选下方"}
    >
      <div className="flex gap-2 items-stretch">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(normalizeTimeInput(e.target.value))}
          placeholder="14:30"
          maxLength={5}
          aria-invalid={error ? true : undefined}
          aria-label={label}
        />
        <button
          type="button"
          disabled={disabled}
          className="shrink-0 h-11 px-3 rounded-lg border border-border bg-surface-elevated text-cyan text-sm hover:border-cyan/50 transition-colors disabled:opacity-40"
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            try {
              el.showPicker?.();
            } catch {
              el.click();
            }
          }}
          aria-label="打开时间选择器"
        >
          时钟
        </button>
        <input
          ref={pickerRef}
          type="time"
          className="sr-only"
          tabIndex={-1}
          value={isValidTime(value) ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-hidden
        />
      </div>
    </Field>
  );
}

function normalizeDateInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isValidTime(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

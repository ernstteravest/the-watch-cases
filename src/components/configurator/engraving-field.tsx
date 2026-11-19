"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function EngravingField({
  value,
  maxLength,
  errors,
  visibleInView,
  onChange,
  onShowLid,
  texts,
}: {
  value: string;
  maxLength: number;
  errors: string[];
  visibleInView: boolean;
  onChange: (value: string) => void;
  onShowLid: () => void;
  texts: { label: string; placeholder: string; help: string; rules: string; showLid: string };
}) {
  const id = useId();
  const length = Array.from(value.trim()).length;
  const hasError = errors.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {texts.label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          autoComplete="off"
          spellCheck={false}
          // A little slack so a too-long entry gets a clear message instead of being cut off silently.
          maxLength={maxLength + 8}
          placeholder={texts.placeholder}
          aria-invalid={hasError || undefined}
          aria-describedby={`${id}-error ${id}-help`}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "min-h-12 w-full rounded-card border bg-paper px-4 pr-16 font-[Georgia,serif] text-lg tracking-[0.08em] text-ink placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-muted/70",
            hasError ? "border-accent" : "border-line-strong",
          )}
        />
        <span
          aria-hidden="true"
          className={cn("absolute top-1/2 right-4 -translate-y-1/2 text-sm tabular-nums", length > maxLength ? "text-accent" : "text-muted")}
        >
          {length}/{maxLength}
        </span>
      </div>
      <p id={`${id}-error`} role={hasError ? "alert" : undefined} className="text-sm font-semibold text-accent empty:hidden">
        {errors.join(" ")}
      </p>
      <p id={`${id}-help`} className="text-sm leading-relaxed text-muted">
        {texts.help} {texts.rules}
      </p>
      {value.trim() && !visibleInView && (
        <button
          type="button"
          onClick={onShowLid}
          className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          {texts.showLid}
        </button>
      )}
    </div>
  );
}

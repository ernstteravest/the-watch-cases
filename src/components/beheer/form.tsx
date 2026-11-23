"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  ...input
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className={cn(
          "min-h-12 rounded-card border border-line-strong bg-paper px-3.5 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25",
          className,
        )}
        {...input}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-pill bg-accent px-7 font-semibold text-paper transition-colors hover:bg-accent-strong disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "rounded-card px-3.5 py-3 text-[15px] leading-snug",
        error ? "bg-[#fbeee8] text-accent-strong" : "bg-sand text-body",
      )}
    >
      {error ?? message}
    </p>
  );
}

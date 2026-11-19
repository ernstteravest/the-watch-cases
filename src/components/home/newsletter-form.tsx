"use client";

import { useActionState, useId } from "react";
import { subscribeToNewsletter, type NewsletterState } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";

type Labels = {
  label: string;
  placeholder: string;
  submit: string;
  invalid: string;
  notReady: string;
  saved: string;
  error: string;
};

export function NewsletterForm({ labels, locale }: { labels: Labels; locale: string }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeToNewsletter, { status: "idle" });
  const id = useId();
  const message = {
    idle: null,
    invalid: labels.invalid,
    "not-ready": labels.notReady,
    saved: labels.saved,
    error: labels.error,
  }[state.status];

  return (
    <form action={action} noValidate className="flex max-w-[480px] flex-[1_1_340px] flex-col gap-2.5">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap gap-2.5">
        <label htmlFor={`${id}-email`} className="sr-only">
          {labels.label}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={labels.placeholder}
          aria-invalid={state.status === "invalid" || undefined}
          aria-describedby={message ? `${id}-msg` : undefined}
          className="min-h-12 flex-[1_1_200px] rounded-card border border-line-strong bg-paper px-4 text-base text-ink placeholder:text-muted/70 aria-invalid:border-accent"
        />
        <Button type="submit" variant="dark" disabled={pending} className="max-sm:w-full">
          {labels.submit}
        </Button>
      </div>
      <p
        id={`${id}-msg`}
        role="status"
        className={state.status === "saved" ? "min-h-5 text-sm font-semibold text-accent" : "min-h-5 text-sm text-muted"}
      >
        {message}
      </p>
    </form>
  );
}

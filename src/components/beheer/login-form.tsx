"use client";

import { useActionState } from "react";
import NextLink from "next/link";
import { signIn, type FormState } from "@/app/beheer/actions/auth";
import { Field, FormAlert, SubmitButton } from "./form";
import { Turnstile } from "./turnstile";

export function LoginForm({ next, siteKey, notice }: { next: string; siteKey: string | null; notice?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormAlert error={state.error} message={state.error ? undefined : notice} />
      <Field key={state.email} label="E-mailadres" name="email" type="email" autoComplete="username" defaultValue={state.email} required autoFocus={!state.email} />
      <Field label="Wachtwoord" name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(state.email)} />
      <Turnstile siteKey={siteKey} />
      <SubmitButton pendingText="Bezig met inloggen…">Inloggen</SubmitButton>
      <NextLink href="/beheer/wachtwoord-vergeten" prefetch={false} className="self-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
        Wachtwoord vergeten?
      </NextLink>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import NextLink from "next/link";
import { requestPasswordReset, setNewPassword, type FormState } from "@/app/beheer/actions/auth";
import { Field, FormAlert, SubmitButton } from "./form";
import { Turnstile } from "./turnstile";

export function ForgotPasswordForm({ siteKey }: { siteKey: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} message={state.message} />
      <Field label="E-mailadres" name="email" type="email" autoComplete="username" required autoFocus />
      <Turnstile siteKey={siteKey} />
      <SubmitButton pendingText="Versturen…">Link versturen</SubmitButton>
      <NextLink href="/beheer/inloggen" prefetch={false} className="self-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
        Terug naar inloggen
      </NextLink>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} />
      <Field
        label="Nieuw wachtwoord"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        autoFocus
        hint="Minimaal 12 tekens. Een zin van een paar woorden werkt goed."
      />
      <Field label="Herhaal het wachtwoord" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      <SubmitButton pendingText="Opslaan…">Wachtwoord opslaan</SubmitButton>
    </form>
  );
}

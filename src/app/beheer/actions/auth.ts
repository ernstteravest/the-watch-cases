"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/admin/audit";
import { checkAttempt, combine } from "@/lib/admin/rate-limit";
import { clientIp, maskEmail, privateHash } from "@/lib/admin/request-info";
import { verifyTurnstile } from "@/lib/admin/turnstile";
import { ACTIVITY_COOKIE, authCookieOptions, beheerPaths, safeNextPath } from "@/lib/admin/session-rules";

export type FormState = { error?: string; message?: string; email?: string };

const GENERIC_LOGIN_ERROR = "E-mailadres of wachtwoord onjuist, of geen toegang tot beheer.";
const TOO_MANY = "Te veel pogingen. Wacht een kwartier en probeer het opnieuw.";
const NOT_CONFIGURED = "Beheer is nog niet gekoppeld aan de database.";
const UNAVAILABLE = "Inloggen is op dit moment niet mogelijk. Probeer het over een paar minuten opnieuw.";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(12, "Kies een wachtwoord van minimaal 12 tekens.")
  .max(128, "Kies een wachtwoord van maximaal 128 tekens.");
const codeSchema = z.string().trim().regex(/^\d{6}$/, "Vul de 6 cijfers uit uw authenticator-app in.");

async function markActive() {
  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), authCookieOptions(process.env.NODE_ENV === "production"));
}

/** Allowed only when the request comes from this website (defence in depth). */
async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ───────────────────────────── Sign in ─────────────────────────────
export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return { error: GENERIC_LOGIN_ERROR };
  const db = await createSessionClient();
  const service = createAdminClient();
  if (!db || !service) return { error: NOT_CONFIGURED };

  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };
  const { email, password } = parsed.data;
  const ip = await clientIp();

  // Limits per network address and per account, before anything else.
  const attempt = combine(
    await Promise.all([
      checkAttempt(`login:ip:${privateHash(ip)}`, 20, 15 * 60),
      checkAttempt(`login:email:${privateHash(email)}`, 5, 15 * 60),
    ]),
  );
  if (attempt === "unavailable") return { error: UNAVAILABLE, email };
  if (attempt === "limited") {
    await logSecurityEvent("auth.login_rate_limited", { details: { email: maskEmail(email) } });
    return { error: TOO_MANY, email };
  }
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    return { error: "De controle tegen automatische inlogpogingen is mislukt. Probeer het opnieuw.", email };
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await logSecurityEvent("auth.login_failed", { details: { email: maskEmail(email) } });
    return { error: GENERIC_LOGIN_ERROR, email };
  }

  // Only active administrators may continue; anyone else is signed out at once.
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || !profile.active) {
    await db.auth.signOut({ scope: "local" });
    await logSecurityEvent("auth.login_denied", {
      actorId: profile?.id ?? null,
      details: { email: maskEmail(email), reason: profile ? "inactive" : "not_admin" },
    });
    return { error: GENERIC_LOGIN_ERROR, email };
  }

  await logSecurityEvent("auth.password_ok", { actorId: profile.id, actorEmail: profile.email });
  await markActive();
  const next = safeNextPath(form.get("next"));
  redirect(`${beheerPaths.mfa}?next=${encodeURIComponent(next)}`);
}

// ───────────────────── Two-factor: verify code ─────────────────────
export async function verifyMfaCode(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return { error: "Ongeldige aanvraag." };
  const db = await createSessionClient();
  if (!db) return { error: NOT_CONFIGURED };
  const { data: userData } = await db.auth.getUser();
  const user = userData.user;
  if (!user) redirect(beheerPaths.login);

  const code = codeSchema.safeParse(form.get("code"));
  if (!code.success) return { error: code.error.issues[0]?.message };
  const attempt = await checkAttempt(`mfa:${user.id}`, 5, 5 * 60);
  if (attempt === "unavailable") return { error: UNAVAILABLE };
  if (attempt === "limited") {
    await logSecurityEvent("auth.mfa_rate_limited", { actorId: user.id, actorEmail: user.email });
    return { error: "Te veel pogingen. Wacht vijf minuten en probeer het opnieuw." };
  }

  // A factor id from the form is only used during first-time setup and
  // must belong to this user; otherwise use their verified factor.
  const { data: factors } = await db.auth.mfa.listFactors();
  const all = factors?.all ?? [];
  const requested = form.get("factorId");
  const factor =
    (typeof requested === "string" && all.find((f) => f.id === requested && f.factor_type === "totp")) ||
    (factors?.totp ?? []).find((f) => f.status === "verified");
  if (!factor) return { error: "Stel eerst uw authenticator-app in." };

  const firstTime = factor.status !== "verified";
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) {
    await logSecurityEvent("auth.mfa_failed", { actorId: user.id, actorEmail: user.email });
    return { error: "Deze code klopt niet of is verlopen. Probeer de nieuwste code." };
  }

  const service = createAdminClient();
  await service?.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  if (firstTime) await logSecurityEvent("auth.mfa_enrolled", { actorId: user.id, actorEmail: user.email });
  await logSecurityEvent("auth.login_succeeded", { actorId: user.id, actorEmail: user.email });
  await markActive();
  redirect(safeNextPath(form.get("next")));
}

// ─────────────── Two-factor: set up the authenticator app ──────────
export type EnrollState = FormState & { factorId?: string; qrSvg?: string; secret?: string };

export async function startMfaEnrollment(): Promise<EnrollState> {
  if (!(await sameOrigin())) return { error: "Ongeldige aanvraag." };
  const db = await createSessionClient();
  if (!db) return { error: NOT_CONFIGURED };
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) redirect(beheerPaths.login);

  const { data: factors } = await db.auth.mfa.listFactors();
  if ((factors?.totp ?? []).some((f) => f.status === "verified")) {
    return { error: "Er is al een authenticator-app ingesteld." };
  }
  // Remove half-finished earlier attempts, so a fresh code can be made.
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await db.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await db.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    issuer: "The Watch Cases beheer",
  });
  if (error || !data) return { error: "Instellen is niet gelukt. Probeer het opnieuw." };
  return { factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret };
}

// ──────────────────────── Password reset ───────────────────────────
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const done: FormState = {
    message: "Als dit e-mailadres bij een beheeraccount hoort, ontvangt u binnen enkele minuten een e-mail met een link.",
  };
  if (!(await sameOrigin())) return done;
  const db = await createSessionClient();
  if (!db) return { error: NOT_CONFIGURED };
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "Vul een geldig e-mailadres in." };
  const ip = await clientIp();

  const attempt = combine(
    await Promise.all([
      checkAttempt(`reset:ip:${privateHash(ip)}`, 10, 60 * 60),
      checkAttempt(`reset:email:${privateHash(email.data)}`, 3, 60 * 60),
    ]),
  );
  if (attempt === "unavailable") return { error: UNAVAILABLE };
  if (attempt === "limited") return done; // same answer: reveals nothing
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    return { error: "De controle tegen automatische aanvragen is mislukt. Probeer het opnieuw." };
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  await db.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}${beheerPaths.confirm}` });
  await logSecurityEvent("auth.password_reset_requested", { details: { email: maskEmail(email.data) } });
  return done;
}

export async function setNewPassword(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return { error: "Ongeldige aanvraag." };
  const db = await createSessionClient();
  if (!db) return { error: NOT_CONFIGURED };
  const { data: userData } = await db.auth.getUser();
  const user = userData.user;
  if (!user) redirect(beheerPaths.login);

  // Someone who has two-factor authentication must have passed it in this
  // session: a reset link alone may not replace the password.
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`${beheerPaths.mfa}?next=${encodeURIComponent(beheerPaths.setPassword)}`);
  }

  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (form.get("password") !== form.get("confirm")) return { error: "De twee wachtwoorden zijn niet gelijk." };

  const { error } = await db.auth.updateUser({ password: password.data });
  if (error) {
    const weak = error.code === "weak_password";
    return {
      error: weak
        ? "Dit wachtwoord is te zwak of komt voor in lijsten van gelekte wachtwoorden. Kies een ander."
        : "Het wachtwoord kon niet worden opgeslagen. Vraag zo nodig een nieuwe link aan.",
    };
  }
  await logSecurityEvent("auth.password_changed", { actorId: user.id, actorEmail: user.email });
  await markActive();
  redirect(beheerPaths.mfa);
}

// ─────────────────────────── Sign out ──────────────────────────────
async function endSession(scope: "local" | "global") {
  const db = await createSessionClient();
  const { data } = (await db?.auth.getUser()) ?? { data: { user: null } };
  if (db && data.user) {
    await logSecurityEvent(scope === "global" ? "auth.logout_everywhere" : "auth.logout", {
      actorId: data.user.id,
      actorEmail: data.user.email,
    });
    await db.auth.signOut({ scope });
  }
  (await cookies()).delete({ name: ACTIVITY_COOKIE, path: "/beheer" });
  redirect(`${beheerPaths.login}?reden=uitgelogd`);
}

export async function signOut(): Promise<void> {
  if (!(await sameOrigin())) return;
  await endSession("local");
}

/** Ends every session of this account, on all devices. */
export async function signOutEverywhere(): Promise<void> {
  if (!(await sameOrigin())) return;
  await endSession("global");
}

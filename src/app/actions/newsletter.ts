"use server";

import { isLocale } from "@/i18n/config";
import { createAdminClient } from "@/lib/supabase/server";

export type NewsletterState = { status: "idle" | "invalid" | "saved" | "not-ready" | "error" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Newsletter sign-up. Validates on the server and stores the address with the
 * time of consent. Confirmation by e-mail (double opt-in) follows once an
 * e-mail service is connected; until then subscribers stay unconfirmed and
 * must not be mailed.
 */
export async function subscribeToNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const localeValue = String(formData.get("locale") ?? "nl");
  const locale = isLocale(localeValue) ? localeValue : "nl";
  if (email.length > 254 || !EMAIL.test(email)) return { status: "invalid" };

  const db = createAdminClient();
  if (!db) return { status: "not-ready" };

  const { error } = await db.from("newsletter_subscribers").insert({ email, locale });
  // 23505 = already subscribed: same answer, so the form never reveals who is on the list.
  if (error && error.code !== "23505") {
    console.error("[newsletter] Could not save sign-up:", error.message);
    return { status: "error" };
  }
  return { status: "saved" };
}

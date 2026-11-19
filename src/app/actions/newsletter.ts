"use server";

export type NewsletterState = { status: "idle" | "invalid" | "not-ready" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Newsletter sign-up. Validates on the server; storing addresses needs a
 * mailing service (decision pending), so for now nothing is saved and the
 * visitor is told so. Replace the "not-ready" branch when one is chosen.
 */
export async function subscribeToNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const email = String(formData.get("email") ?? "").trim();
  if (email.length > 254 || !EMAIL.test(email)) return { status: "invalid" };
  return { status: "not-ready" };
}

import "server-only";

/**
 * E-mail through Resend's REST API. Switched off until RESEND_API_KEY and
 * EMAIL_FROM are set (EMAIL_FROM needs a verified sending domain, e.g.
 * "The Watch Cases <orders@thewatchcases.nl>"). While off, nothing is sent
 * and the attempt is logged, so ordering never fails because of e-mail.
 */
export type Email = { to: string; subject: string; text: string; html: string; replyTo?: string };

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(email: Email): Promise<"sent" | "skipped" | "failed"> {
  if (!emailConfigured()) {
    console.info(`[email] Not configured; not sent: "${email.subject}"`);
    return "skipped";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend refused the e-mail:", res.status, await res.text());
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("[email] Could not reach Resend:", e);
    return "failed";
  }
}

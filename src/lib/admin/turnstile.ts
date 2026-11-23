import "server-only";

/**
 * Cloudflare Turnstile: a privacy-friendly check that a login attempt comes
 * from a person, not a bot. Free. Switched on when both keys are set.
 */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
const secret = process.env.TURNSTILE_SECRET_KEY ?? null;

export function isTurnstileEnabled(): boolean {
  return Boolean(turnstileSiteKey && secret);
}

/** True when the check passed (or Turnstile isn't configured). */
export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: secret as string, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

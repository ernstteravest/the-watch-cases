/**
 * Rules for administrator sessions in /beheer. Pure functions, so they can be
 * used in the proxy, in server code and in tests.
 */

export const BEHEER = "/beheer";

export const beheerPaths = {
  home: "/beheer",
  login: "/beheer/inloggen",
  mfa: "/beheer/tweestaps",
  forgotPassword: "/beheer/wachtwoord-vergeten",
  setPassword: "/beheer/wachtwoord-instellen",
  confirm: "/beheer/auth/bevestigen",
  noAccess: "/beheer/geen-toegang",
} as const;

/** Signed out automatically after this long without any request to /beheer. */
export const IDLE_TIMEOUT_MINUTES = 30;
/** Signed out after this long since the password was entered, however active. */
export const MAX_SESSION_HOURS = 12;

/** Cookie with the time of the last request to /beheer (HTTP-only). */
export const ACTIVITY_COOKIE = "twc_beheer_active";

/** Auth cookies live only under /beheer and are unreadable for scripts. */
export function authCookieOptions(production: boolean) {
  return {
    path: BEHEER,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    maxAge: MAX_SESSION_HOURS * 60 * 60,
  };
}

export function isBeheerPath(pathname: string): boolean {
  return pathname === BEHEER || pathname.startsWith(`${BEHEER}/`);
}

/** Pages anyone may open (they handle signing in). */
export function isPublicBeheerPath(pathname: string): boolean {
  return (
    pathname === beheerPaths.login ||
    pathname === beheerPaths.forgotPassword ||
    pathname === beheerPaths.confirm
  );
}

/**
 * Pages for a signed-in user who has not passed two-factor authentication
 * yet: the code screen (also for first-time setup) and, for a brand-new
 * account without a second factor, choosing a password.
 */
export function isPreMfaPath(pathname: string): boolean {
  return pathname === beheerPaths.mfa || pathname === beheerPaths.setPassword;
}

/**
 * Where to go after signing in. Only paths inside /beheer are accepted, so a
 * crafted link can't send an administrator to another website.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return beheerPaths.home;
  if (!isBeheerPath(next.split(/[?#]/)[0])) return beheerPaths.home;
  if (next.includes("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return beheerPaths.home;
  if (isPublicBeheerPath(next.split(/[?#]/)[0])) return beheerPaths.home;
  return next;
}

type AmrEntry = { method?: string; timestamp?: number } | string;

/**
 * When the user last entered their password (seconds since 1970), from the
 * access token's `amr` claim. Falls back to the token's issue time.
 */
export function passwordSignInTime(claims: { amr?: AmrEntry[]; iat?: number }): number | null {
  const times = (claims.amr ?? [])
    .filter((e): e is { method?: string; timestamp?: number } => typeof e === "object" && e !== null)
    .filter((e) => e.method === "password" || e.method === "recovery" || e.method === "invite" || e.method === "otp")
    .map((e) => e.timestamp)
    .filter((t): t is number => typeof t === "number");
  if (times.length > 0) return Math.max(...times);
  return typeof claims.iat === "number" ? claims.iat : null;
}

export type ExpiryReason = "idle" | "max" | null;

/** Why the session must end now, or null if it may continue. */
export function sessionExpiry(
  claims: { amr?: AmrEntry[]; iat?: number },
  lastActiveMs: number | null,
  nowMs: number,
): ExpiryReason {
  const signedIn = passwordSignInTime(claims);
  if (signedIn !== null && nowMs - signedIn * 1000 > MAX_SESSION_HOURS * 3600_000) return "max";
  if (lastActiveMs !== null && nowMs - lastActiveMs > IDLE_TIMEOUT_MINUTES * 60_000) return "idle";
  return null;
}

/**
 * Content Security Policy for /beheer: scripts only with this request's
 * nonce (plus what they load), nothing from other sites except Supabase
 * and Cloudflare Turnstile (the login check).
 */
export function beheerCsp(nonce: string, supabaseUrl: string | undefined, dev: boolean): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' blob: data:", supabase].filter(Boolean).join(" "),
    "font-src 'self'",
    ["connect-src 'self'", supabase, "https://challenges.cloudflare.com"].filter(Boolean).join(" "),
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

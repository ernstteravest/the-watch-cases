import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/supabase/env";
import {
  ACTIVITY_COOKIE,
  authCookieOptions,
  beheerCsp,
  beheerPaths,
  isPreMfaPath,
  isPublicBeheerPath,
  sessionExpiry,
} from "./session-rules";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

/**
 * First line of defence for /beheer (the pages and actions check again):
 *  - a fresh CSP nonce on every request; pages are never cached;
 *  - not signed in → login page;
 *  - signed in without two-factor authentication → code page;
 *  - idle too long or signed in too long → signed out.
 * Whether the user is an (active) administrator with the right permission
 * is checked on the server by each page and action, and by the database.
 */
export async function beheerProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const dev = process.env.NODE_ENV === "development";
  const production = process.env.NODE_ENV === "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = beheerCsp(nonce, supabasePublicEnv.url, dev);

  const cookiesToSet: CookieToSet[] = [];
  let cacheHeaders: Record<string, string> = {};

  const finish = (response: NextResponse) => {
    for (const c of cookiesToSet) response.cookies.set(c.name, c.value, c.options);
    for (const [k, v] of Object.entries(cacheHeaders)) response.headers.set(k, v);
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  };
  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = new URLSearchParams(params).toString();
    return finish(NextResponse.redirect(url, 303));
  };
  const pass = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return finish(NextResponse.next({ request: { headers } }));
  };

  // Not connected to Supabase (e.g. local preview): the pages explain this.
  if (!supabasePublicEnv.url || !supabasePublicEnv.publicKey) {
    return isPublicBeheerPath(pathname) ? pass() : redirectTo(beheerPaths.login);
  }

  const supabase = createServerClient(supabasePublicEnv.url, supabasePublicEnv.publicKey, {
    cookieOptions: authCookieOptions(production),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          cookiesToSet.push(c as CookieToSet);
        }
        if (headers) cacheHeaders = { ...cacheHeaders, ...headers };
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  if (!claims) {
    if (isPublicBeheerPath(pathname)) return pass();
    return redirectTo(beheerPaths.login, pathname === beheerPaths.home ? {} : { next: pathname + search });
  }

  const now = Date.now();
  const lastActive = Number(request.cookies.get(ACTIVITY_COOKIE)?.value);
  const expired = sessionExpiry(claims, Number.isFinite(lastActive) && lastActive > 0 ? lastActive : null, now);
  if (expired) {
    await supabase.auth.signOut({ scope: "local" });
    cookiesToSet.push({ name: ACTIVITY_COOKIE, value: "", options: { ...authCookieOptions(production), maxAge: 0 } });
    return redirectTo(beheerPaths.login, { reden: expired === "idle" ? "inactief" : "verlopen" });
  }
  cookiesToSet.push({ name: ACTIVITY_COOKIE, value: String(now), options: authCookieOptions(production) });

  if (claims.aal !== "aal2" && !isPublicBeheerPath(pathname) && !isPreMfaPath(pathname)) {
    return redirectTo(beheerPaths.mfa, pathname === beheerPaths.home ? {} : { next: pathname + search });
  }
  return pass();
}

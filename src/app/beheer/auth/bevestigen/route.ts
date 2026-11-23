import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/session";
import { beheerPaths } from "@/lib/admin/session-rules";

const allowedTypes: readonly EmailOtpType[] = ["invite", "recovery", "email"];

/**
 * Landing point for the links in invitation and password-reset e-mails.
 * Verifies the one-time token with Supabase and continues to "choose a
 * password". The token is single-use and expires (Supabase settings).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const failed = () => {
    const url = request.nextUrl.clone();
    url.pathname = beheerPaths.login;
    url.search = "?reden=link-ongeldig";
    return NextResponse.redirect(url, 303);
  };

  const db = await createSessionClient();
  if (!db) return failed();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type && allowedTypes.includes(type)) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failed();
  } else if (code) {
    // Password reset requested from this same browser (PKCE flow).
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) return failed();
  } else {
    return failed();
  }

  const url = request.nextUrl.clone();
  url.pathname = beheerPaths.setPassword;
  url.search = "";
  return NextResponse.redirect(url, 303);
}

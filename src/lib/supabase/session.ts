import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublicEnv } from "./env";
import { authCookieOptions } from "@/lib/admin/session-rules";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionDb = SupabaseClient<Database>;

/**
 * Supabase as the signed-in administrator (public key + their session
 * cookie). Every query runs under Row Level Security with their rights.
 * Returns null when Supabase isn't configured.
 */
export async function createSessionClient(): Promise<SessionDb | null> {
  const { url, publicKey } = supabasePublicEnv;
  if (!url || !publicKey) return null;
  const store = await cookies();
  return createServerClient<Database>(url, publicKey, {
    cookieOptions: authCookieOptions(process.env.NODE_ENV === "production"),
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const c of list) store.set(c.name, c.value, c.options);
        } catch {
          // Called from a page render, where cookies are read-only. The proxy
          // refreshes the session on every request, so this is safe to skip.
        }
      },
    },
  });
}

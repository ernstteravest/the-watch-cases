import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase connections for server code only.
 *
 * Variable names: Vercel's Supabase integration has used two naming schemes
 * over time (anon/service_role and publishable/secret); both are accepted.
 * The secret key never has a NEXT_PUBLIC_ prefix, so it can't reach a browser.
 */
const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  publicKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY,
  secretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export type Db = SupabaseClient<Database>;

const options = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** True when the website is connected to Supabase (env vars present). */
export function isDatabaseConfigured(): boolean {
  return Boolean(env.url && env.publicKey && env.secretKey);
}

/** Read-only access with the public key: subject to Row Level Security, like a visitor. */
export function createPublicClient(): Db | null {
  if (!env.url || !env.publicKey) return null;
  return createClient<Database>(env.url, env.publicKey, options);
}

/**
 * Full access with the secret key, bypassing Row Level Security.
 * Use only in server actions and route handlers, after validating input.
 */
export function createAdminClient(): Db | null {
  if (!env.url || !env.secretKey) return null;
  return createClient<Database>(env.url, env.secretKey, options);
}

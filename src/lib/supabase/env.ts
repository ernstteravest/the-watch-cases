/**
 * Public Supabase settings (safe for the browser: the URL and the public key,
 * which only grants what Row Level Security allows). The secret key is read
 * in ./server.ts only.
 *
 * Vercel's Supabase integration has used two naming schemes over time
 * (anon/service_role and publishable/secret); both are accepted.
 */
export const supabasePublicEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  publicKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY,
};

import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/** Secret for hashing; never sent anywhere. */
function hashKey(): string {
  return (
    process.env.ADMIN_HASH_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "local-development-only"
  );
}

/** One-way hash, so logs and rate limits never hold raw IP or e-mail addresses. */
export function privateHash(value: string): string {
  return createHmac("sha256", hashKey()).update(value).digest("hex").slice(0, 32);
}

/** The visitor's IP address as reported by the hosting platform. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/** e.g. "j***@example.com": enough to recognise, not the full address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 1)}***@${domain}`;
}

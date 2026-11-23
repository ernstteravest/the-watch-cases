import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { clientIp, privateHash } from "./request-info";

/**
 * Security events written by the server itself (login attempts, sign-outs),
 * including ones without a signed-in administrator. Failures to log never
 * block the user, but are reported in the server log.
 */
export async function logSecurityEvent(
  action: string,
  options: { actorId?: string | null; actorEmail?: string | null; details?: Json } = {},
): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  const { error } = await db.from("audit_logs").insert({
    action,
    entity: "auth",
    actor_id: options.actorId ?? null,
    actor_email: options.actorEmail ?? null,
    details: options.details ?? {},
    ip_hash: privateHash(await clientIp()),
  });
  if (error) console.error("audit log failed", action, error.code);
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type AttemptResult = "allowed" | "limited" | "unavailable";

/**
 * Counts an attempt for `key` and says whether it is still allowed.
 * When the database can't be reached the answer is "unavailable", and the
 * caller refuses the attempt (fail closed).
 */
export async function checkAttempt(key: string, limit: number, windowSeconds: number): Promise<AttemptResult> {
  const db = createAdminClient();
  if (!db) return "unavailable";
  const { data, error } = await db.rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.code ?? error.message);
    return "unavailable";
  }
  return data === true ? "allowed" : "limited";
}

/** Combines several checks: unavailable wins, then limited. */
export function combine(results: AttemptResult[]): AttemptResult {
  if (results.includes("unavailable")) return "unavailable";
  if (results.includes("limited")) return "limited";
  return "allowed";
}

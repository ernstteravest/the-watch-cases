import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient, type SessionDb } from "@/lib/supabase/session";
import type { Permission } from "@/lib/supabase/database.types";
import { beheerPaths } from "./session-rules";

export type Administrator = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: ReadonlySet<Permission>;
};

export type AdminContext =
  | { status: "not-configured" }
  | { status: "signed-out" }
  | { status: "needs-mfa"; userId: string; email: string; hasFactor: boolean }
  | { status: "no-access"; userId: string; email: string }
  | { status: "ok"; admin: Administrator; db: SessionDb };

/**
 * Who is using /beheer right now: the single place where the session is
 * checked (the "data access layer"). Verified against Supabase on every
 * request; cached only for the duration of one request.
 */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const db = await createSessionClient();
  if (!db) return { status: "not-configured" };

  const { data: claimData } = await db.auth.getClaims();
  const claims = claimData?.claims;
  if (!claims?.sub) return { status: "signed-out" };
  const email = typeof claims.email === "string" ? claims.email : "";

  if (claims.aal !== "aal2") {
    const { data: factors } = await db.auth.mfa.listFactors();
    const hasFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
    return { status: "needs-mfa", userId: claims.sub, email, hasFactor };
  }

  // Profile and permissions, read with the user's own rights (RLS).
  const [{ data: profile }, { data: permissions }] = await Promise.all([
    db.from("profiles").select("id, email, full_name, role_id, active").eq("id", claims.sub).maybeSingle(),
    db.rpc("my_permissions"),
  ]);
  if (!profile || !profile.active) return { status: "no-access", userId: claims.sub, email };

  const { data: role } = await db.from("roles").select("name_nl").eq("id", profile.role_id).maybeSingle();

  return {
    status: "ok",
    db,
    admin: {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      roleId: profile.role_id,
      roleName: role?.name_nl ?? profile.role_id,
      permissions: new Set((permissions ?? []) as Permission[]),
    },
  };
});

/**
 * For every /beheer page and action: returns the administrator, or sends
 * the user to the right place. With `permission`, also requires that right.
 */
export async function requireAdmin(permission?: Permission): Promise<{ admin: Administrator; db: SessionDb }> {
  const ctx = await getAdminContext();
  switch (ctx.status) {
    case "not-configured":
    case "signed-out":
      redirect(beheerPaths.login);
    case "needs-mfa":
      redirect(beheerPaths.mfa);
    case "no-access":
      redirect(beheerPaths.noAccess);
    case "ok":
      if (permission && !ctx.admin.permissions.has(permission)) redirect(beheerPaths.noAccess);
      return { admin: ctx.admin, db: ctx.db };
  }
}

export function can(admin: Administrator, permission: Permission): boolean {
  return admin.permissions.has(permission);
}

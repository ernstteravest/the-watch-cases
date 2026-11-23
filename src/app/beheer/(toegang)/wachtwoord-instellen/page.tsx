import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";
import { beheerPaths } from "@/lib/admin/session-rules";
import { AuthCard } from "@/components/beheer/auth-card";
import { NotConfigured } from "@/components/beheer/not-configured";
import { SetPasswordForm } from "@/components/beheer/password-forms";

export const metadata: Metadata = { title: "Wachtwoord instellen" };

/**
 * Reached through an invitation or password-reset link. Someone who already
 * has two-factor authentication must pass it first (the proxy and this
 * check), so a stolen reset e-mail alone is not enough to take over an account.
 */
export default async function SetPasswordPage() {
  const ctx = await getAdminContext();
  if (ctx.status === "not-configured") return <NotConfigured />;
  if (ctx.status === "signed-out") redirect(beheerPaths.login);
  if (ctx.status === "needs-mfa" && ctx.hasFactor) {
    redirect(`${beheerPaths.mfa}?next=${encodeURIComponent(beheerPaths.setPassword)}`);
  }
  if (ctx.status === "no-access") redirect(beheerPaths.noAccess);
  return (
    <AuthCard title="Wachtwoord instellen" intro="Kies een sterk wachtwoord dat u nergens anders gebruikt.">
      <SetPasswordForm />
    </AuthCard>
  );
}

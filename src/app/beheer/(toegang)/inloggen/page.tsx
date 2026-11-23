import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";
import { beheerPaths, safeNextPath } from "@/lib/admin/session-rules";
import { turnstileSiteKey } from "@/lib/admin/turnstile";
import { AuthCard } from "@/components/beheer/auth-card";
import { LoginForm } from "@/components/beheer/login-form";
import { NotConfigured } from "@/components/beheer/not-configured";

export const metadata: Metadata = { title: "Inloggen" };

const notices: Record<string, string> = {
  uitgelogd: "U bent uitgelogd.",
  inactief: "U bent automatisch uitgelogd na 30 minuten zonder activiteit.",
  verlopen: "Uw sessie is verlopen. Log opnieuw in.",
  "link-ongeldig": "Deze link is ongeldig of verlopen. Vraag zo nodig een nieuwe aan.",
};

export default async function LoginPage({ searchParams }: PageProps<"/beheer/inloggen">) {
  const ctx = await getAdminContext();
  if (ctx.status === "not-configured") return <NotConfigured />;
  if (ctx.status === "ok") redirect(beheerPaths.home);
  if (ctx.status === "needs-mfa") redirect(beheerPaths.mfa);

  const { next, reden } = await searchParams;
  const notice = typeof reden === "string" ? notices[reden] : undefined;
  return (
    <AuthCard title="Inloggen" intro="Alleen voor medewerkers van The Watch Cases.">
      <LoginForm next={safeNextPath(next)} siteKey={turnstileSiteKey} notice={notice} />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/auth";
import { beheerPaths, safeNextPath } from "@/lib/admin/session-rules";
import { AuthCard } from "@/components/beheer/auth-card";
import { MfaCodeForm, MfaEnrollForm } from "@/components/beheer/mfa-forms";
import { NotConfigured } from "@/components/beheer/not-configured";
import { SignOutButton } from "@/components/beheer/sign-out-buttons";

export const metadata: Metadata = { title: "Tweestapsverificatie" };

export default async function MfaPage({ searchParams }: PageProps<"/beheer/tweestaps">) {
  const ctx = await getAdminContext();
  if (ctx.status === "not-configured") return <NotConfigured />;
  if (ctx.status === "signed-out") redirect(beheerPaths.login);
  const next = safeNextPath((await searchParams).next);
  if (ctx.status === "ok") redirect(next);
  if (ctx.status === "no-access") redirect(beheerPaths.noAccess);

  const footer = (
    <div className="mt-6 flex justify-center">
      <SignOutButton />
    </div>
  );

  if (ctx.hasFactor) {
    return (
      <AuthCard title="Tweestapsverificatie" intro="Open uw authenticator-app en vul de code van 6 cijfers in.">
        <MfaCodeForm next={next} />
        {footer}
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Tweestapsverificatie instellen"
      intro="Voor beheer is een tweede stap verplicht: naast uw wachtwoord een code uit een app op uw telefoon. Dit stelt u eenmalig in."
    >
      <MfaEnrollForm next={next} />
      {footer}
    </AuthCard>
  );
}

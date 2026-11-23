import type { Metadata } from "next";
import { turnstileSiteKey } from "@/lib/admin/turnstile";
import { isDatabaseConfigured } from "@/lib/supabase/server";
import { AuthCard } from "@/components/beheer/auth-card";
import { NotConfigured } from "@/components/beheer/not-configured";
import { ForgotPasswordForm } from "@/components/beheer/password-forms";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  if (!isDatabaseConfigured()) return <NotConfigured />;
  return (
    <AuthCard title="Wachtwoord vergeten" intro="Vul het e-mailadres van uw beheeraccount in. U ontvangt een link om een nieuw wachtwoord te kiezen.">
      <ForgotPasswordForm siteKey={turnstileSiteKey} />
    </AuthCard>
  );
}

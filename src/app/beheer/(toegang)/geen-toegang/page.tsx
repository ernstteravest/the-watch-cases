import type { Metadata } from "next";
import NextLink from "next/link";
import { getAdminContext } from "@/lib/admin/auth";
import { AuthCard } from "@/components/beheer/auth-card";
import { SignOutButton } from "@/components/beheer/sign-out-buttons";

export const metadata: Metadata = { title: "Geen toegang" };

export default async function NoAccessPage() {
  const ctx = await getAdminContext();
  const isAdmin = ctx.status === "ok";
  return (
    <AuthCard
      title="Geen toegang"
      intro={
        isAdmin
          ? "Uw rol geeft geen toegang tot dit onderdeel. Neem contact op met de eigenaar als u dit wel nodig heeft."
          : "Dit account heeft (nog) geen toegang tot beheer, of de toegang is ingetrokken."
      }
    >
      <div className="flex items-center justify-between gap-4">
        {isAdmin ? (
          <NextLink href="/beheer" prefetch={false} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
            Naar het overzicht
          </NextLink>
        ) : (
          <span />
        )}
        {ctx.status !== "signed-out" && ctx.status !== "not-configured" && <SignOutButton />}
      </div>
    </AuthCard>
  );
}

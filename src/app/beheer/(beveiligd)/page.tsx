import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { SignOutEverywhereButton } from "@/components/beheer/sign-out-buttons";
import { IDLE_TIMEOUT_MINUTES, MAX_SESSION_HOURS } from "@/lib/admin/session-rules";

export const metadata: Metadata = { title: "Overzicht" };

const permissionLabels: Record<string, string> = {
  "dashboard.view": "Dashboard bekijken",
  "orders.read": "Bestellingen bekijken",
  "orders.manage": "Bestellingen bijwerken",
  "orders.refund": "Terugbetalingen doen",
  "customers.read": "Klanten bekijken",
  "customers.manage": "Klanten bijwerken",
  "customers.export": "Klantgegevens exporteren",
  "customers.delete": "Klantgegevens wissen",
  "products.manage": "Producten en prijzen beheren",
  "content.edit": "Website-inhoud bewerken",
  "content.publish": "Website-inhoud publiceren",
  "media.manage": "Mediabibliotheek beheren",
  "analytics.view": "Statistieken bekijken",
  "settings.read": "Instellingen bekijken",
  "settings.manage": "Instellingen wijzigen",
  "users.manage": "Beheerders beheren",
  "audit.read": "Logboek bekijken",
};

export default async function BeheerHome() {
  const { admin } = await requireAdmin("dashboard.view");
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Welkom, {admin.name}</h1>
        <p className="mt-2 text-body">
          U bent ingelogd als <strong>{admin.roleName}</strong> met tweestapsverificatie. Het dashboard,
          bestellingen, producten en website-inhoud volgen in de volgende fasen.
        </p>
      </div>

      <section className="rounded-card border border-line bg-paper p-6">
        <h2 className="text-lg font-bold">Uw rechten</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-[15px] text-body sm:grid-cols-2">
          {[...admin.permissions].sort().map((p) => (
            <li key={p}>✓ {permissionLabels[p] ?? p}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-paper p-6">
        <h2 className="text-lg font-bold">Beveiliging</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-body">
          U wordt automatisch uitgelogd na {IDLE_TIMEOUT_MINUTES} minuten zonder activiteit en uiterlijk{" "}
          {MAX_SESSION_HOURS} uur na het inloggen. Vermoedt u dat iemand anders toegang heeft? Log dan overal uit en
          wijzig uw wachtwoord.
        </p>
        <div className="mt-4">
          <SignOutEverywhereButton />
        </div>
      </section>
    </div>
  );
}

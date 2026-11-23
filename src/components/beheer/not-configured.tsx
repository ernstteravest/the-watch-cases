import { AuthCard } from "./auth-card";

export function NotConfigured() {
  return (
    <AuthCard
      title="Beheer is nog niet gekoppeld"
      intro="De verbinding met de database (Supabase) ontbreekt in deze omgeving. Op de live website wordt deze ingesteld via de omgevingsvariabelen."
    >
      <p className="text-sm text-muted">Zie docs/beheer-setup.md in de repository.</p>
    </AuthCard>
  );
}

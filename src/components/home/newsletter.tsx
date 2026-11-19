import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { NewsletterForm } from "./newsletter-form";

export function Newsletter({ t, locale }: { t: Dictionary; locale: Locale }) {
  const n = t.home.newsletter;
  return (
    <section className="border-t border-line bg-paper">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-12 gap-y-5 py-section-sm">
        <div className="flex-[1_1_360px]">
          <h2 className="mb-1.5 text-h3 font-bold">{n.title}</h2>
          <p className="text-muted">{n.text}</p>
        </div>
        <NewsletterForm
          locale={locale}
          labels={{
            label: n.label,
            placeholder: n.placeholder,
            submit: n.submit,
            invalid: n.invalid,
            notReady: n.notReady,
            saved: n.saved,
            error: n.error,
          }}
        />
      </div>
    </section>
  );
}

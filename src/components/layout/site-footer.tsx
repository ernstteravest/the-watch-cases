import Link from "next/link";
import { getFooterNav, getLegalNav } from "@/config/navigation";
import { features, site } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { Logo } from "@/components/brand/logo";
import { InstagramIcon, LinkedInIcon } from "@/components/ui/icons";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const groups = getFooterNav(locale, t);
  const legal = getLegalNav(locale, t);
  const year = 2026; // Static so pages can be prerendered; update yearly or when content changes.

  return (
    <footer className="bg-espresso text-cream">
      <div className="container-page flex flex-col gap-14 pt-[72px] pb-8">
        <Logo size="lg" />

        <div className="grid grid-cols-2 gap-x-12 gap-y-9 border-t border-cream/18 pt-10 md:grid-cols-4">
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="flex flex-col gap-2.5 text-[15px]">
              <span className="font-bold">{group.title}</span>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="text-cream-muted hover:text-cream">
                  {item.label}
                </Link>
              ))}
            </nav>
          ))}
          <div className="col-span-2 flex flex-col gap-2.5 text-[15px] md:col-span-1">
            <span className="font-bold">{t.footer.contact}</span>
            <a href={`mailto:${site.email}`} className="break-all text-cream-muted hover:text-cream">
              {site.email}
            </a>
            <span className="text-cream-muted">{t.footer.location}</span>
            {(site.social.instagram || site.social.linkedin) && (
              <span className="mt-1 flex gap-3.5">
                {site.social.instagram && (
                  <a href={site.social.instagram} aria-label="Instagram" className="text-cream-muted hover:text-cream">
                    <InstagramIcon />
                  </a>
                )}
                {site.social.linkedin && (
                  <a href={site.social.linkedin} aria-label="LinkedIn" className="text-cream-muted hover:text-cream">
                    <LinkedInIcon />
                  </a>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-cream/18 pt-6">
          {features.payments && (
            <ul className="flex flex-wrap gap-2 text-xs text-cream-muted">
              {site.paymentMethods.map((method) => (
                <li key={method} className="rounded-card border border-cream/30 px-[9px] py-1">
                  {method}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[13px] text-cream-faint">
            <span>
              © {year} {t.footer.rights}
            </span>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1.5">
              {legal.map((item) => (
                <Link key={item.href} href={item.href} className="text-cream-muted underline-offset-4 hover:text-cream hover:underline">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

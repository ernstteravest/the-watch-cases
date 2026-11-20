import Link from "next/link";
import { isProductEnabled } from "@/catalog/availability";
import { features } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { Button } from "@/components/ui/button";

/**
 * Sticky bar that jumps to the sections below. On phones it scrolls
 * sideways instead of wrapping onto several lines.
 */
export function CollectionNav({ locale, t }: { locale: Locale; t: Dictionary }) {
  const links = [
    { label: t.home.subnav.all, href: "#collection", current: true },
    { label: t.nav.duo, href: "#duo" },
    ...(isProductEnabled("quartet-slim") ? [{ label: t.nav.quartetSlim, href: "#quartet-slim" }] : []),
    ...(features.readyMadeDesigns ? [{ label: t.nav.designs, href: "#designs" }] : []),
    { label: t.nav.howItsMade, href: "#how-its-made" },
  ];

  return (
    <nav
      aria-label={t.home.subnav.label}
      className="sticky top-0 z-10 border-y border-line bg-paper/94 backdrop-blur-md backdrop-saturate-[1.4]"
    >
      <div className="container-page flex items-center gap-x-8 overflow-x-auto py-2.5 text-[15px] font-semibold [scrollbar-width:none] md:justify-center md:gap-x-10 [&::-webkit-scrollbar]:hidden">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={link.current ? "true" : undefined}
            className="inline-flex min-h-11 flex-none items-center whitespace-nowrap hover:text-accent aria-[current]:text-accent"
          >
            {link.label}
          </a>
        ))}
        <Button asChild size="sm" className="flex-none">
          <Link href={href("configure", locale)}>{t.home.subnav.cta}</Link>
        </Button>
      </div>
    </nav>
  );
}

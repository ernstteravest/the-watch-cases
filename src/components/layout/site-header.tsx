import Link from "next/link";
import { getMainNav } from "@/config/navigation";
import { site } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { Logo } from "@/components/brand/logo";
import { BagIcon, PinIcon } from "@/components/ui/icons";
import { LanguageSwitch } from "./language-switch";
import { MainMenu } from "./main-menu";

/** Menu icon left, wordmark centred, language / Amsterdam / bag right. */
export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  const nav = getMainNav(locale, t);
  // The cart is built in Stage 7; until then the bag shows 0 items.
  const bagLabel = t.a11y.bagMany.replace("{count}", "0");

  return (
    <header className="relative z-20 bg-paper">
      <div className="container-page grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 py-3">
        <MainMenu
          primary={nav.primary}
          secondary={nav.secondary}
          homeHref={href("home", locale)}
          labels={{ open: t.a11y.openMenu, close: t.a11y.closeMenu, title: t.a11y.mainMenu, home: t.a11y.home }}
          footer={{ email: site.email, location: t.footer.location }}
          languageSwitch={<LanguageSwitch locale={locale} label={t.a11y.switchLanguage} className="-ms-3" />}
        />
        <Link href={href("home", locale)} aria-label={t.a11y.home} className="text-ink hover:text-ink">
          <Logo />
        </Link>
        <div className="flex items-center justify-self-end gap-1">
          <LanguageSwitch locale={locale} label={t.a11y.switchLanguage} className="hidden sm:grid" />
          <Link
            href={href("amsterdam", locale)}
            aria-label={t.a11y.amsterdam}
            className="hidden size-11 place-items-center hover:text-accent sm:grid"
          >
            <PinIcon />
          </Link>
          <Link href={href("cart", locale)} aria-label={bagLabel} className="grid size-11 place-items-center hover:text-accent">
            <BagIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

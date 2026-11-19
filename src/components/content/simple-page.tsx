import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { getDictionary } from "@/i18n/get-dictionary";
import { href, type RouteKey } from "@/i18n/routes";
import { pageMetadata } from "@/lib/page-metadata";
import { ContentPage } from "./content-page";

type PageKey = Exclude<keyof Dictionary["pages"], "comingSoon" | "legalComingSoon" | "backHome" | "emailUs" | "notFound">;

type Options = {
  /** Show the contact e-mail address. */
  email?: boolean;
  /** Legal text supplied by the business later. */
  legal?: boolean;
  /** Page is complete as is (no "coming soon" note). */
  complete?: boolean;
  /** Link shown at the bottom. */
  link?: { route: RouteKey; label: (t: Dictionary) => string };
};

type Props = { params: Promise<{ lang: string }> };

/**
 * Builds a simple page (and its metadata) for a route from the texts in
 * `t.pages[key]`. Replace with a real page component once content exists.
 */
export function simplePage(route: RouteKey, key: PageKey, options: Options = {}) {
  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { lang } = await params;
    if (!isLocale(lang)) return {};
    const t = await getDictionary(lang);
    const page = t.pages[key];
    return pageMetadata(route, lang, { title: page.title, description: page.intro });
  }

  async function Page({ params }: Props) {
    const { lang } = await params;
    if (!isLocale(lang)) notFound();
    const t = await getDictionary(lang);
    const page = t.pages[key];
    const link = options.link ?? { route: "home" as RouteKey, label: (d: Dictionary) => d.pages.backHome };
    return (
      <ContentPage
        title={page.title}
        intro={page.intro}
        email={options.email ? t.pages.emailUs : undefined}
        notice={options.complete ? undefined : options.legal ? t.pages.legalComingSoon : t.pages.comingSoon}
        back={{ label: link.label(t), href: href(link.route, lang) }}
      />
    );
  }

  return { Page, generateMetadata };
}

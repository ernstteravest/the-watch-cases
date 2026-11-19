import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { isLocale, localeTags, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "../globals.css";

// Archivo variable font with the width axis (the wordmark uses 125% width).
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s – ${site.name}` },
    description: t.meta.description,
    applicationName: site.name,
    alternates: {
      canonical: href("home", lang),
      languages: { nl: href("home", "nl"), en: href("home", "en"), "x-default": href("home", "nl") },
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: localeTags[lang].replace("-", "_"),
      title: t.meta.title,
      description: t.meta.description,
    },
    // Not public yet: keep search engines out until launch.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#1E1611",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <html lang={localeTags[lang]} className={archivo.variable}>
      <body className="flex min-h-dvh flex-col">
        {/* Without JavaScript, never leave fade-in content hidden. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only z-50 bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.a11y.skipToContent}
        </a>
        <AnnouncementBar messages={t.announcement} />
        <SiteHeader locale={lang} t={t} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={lang} t={t} />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/catalog/catalog-data";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { pageMetadata } from "@/lib/page-metadata";
import { CartView } from "@/components/cart/cart-view";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { ...pageMetadata("cart", lang, { title: t.cart.title }), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const prices = Object.fromEntries((await getProducts()).map((p) => [p.slug, p.priceFromCents]));

  return (
    <div className="container-page py-section">
      <h1 className="mb-10 text-h1 font-bold text-accent">{t.cart.title}</h1>
      <CartView
        locale={lang}
        t={t.cart}
        summaryTexts={t.configurator}
        prices={prices}
        links={{ checkout: href("checkout", lang), configure: href("configure", lang), collection: href("collection", lang) }}
      />
    </div>
  );
}

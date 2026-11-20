import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/catalog/catalog-data";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { pageMetadata } from "@/lib/page-metadata";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { ...pageMetadata("checkout", lang, { title: t.checkout.title }), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[lang]/checkout">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const prices = Object.fromEntries((await getProducts()).map((p) => [p.slug, p.priceFromCents]));

  return (
    <div className="container-page py-section">
      <h1 className="mb-10 text-h1 font-bold text-accent">{t.checkout.title}</h1>
      <CheckoutForm
        locale={lang}
        t={t.checkout}
        summaryTexts={t.configurator}
        prices={prices}
        links={{ terms: href("terms", lang), cart: href("cart", lang) }}
        extraLabels={{ shipping: t.cart.shipping, cart: t.cart.title }}
      />
    </div>
  );
}

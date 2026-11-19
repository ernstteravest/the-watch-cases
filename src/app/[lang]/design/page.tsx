import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/catalog/catalog-data";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { formatPrice } from "@/lib/format";
import { pageMetadata } from "@/lib/page-metadata";
import { ConfiguratorLoader } from "@/components/configurator/configurator-loader";

export async function generateMetadata({ params }: PageProps<"/[lang]/design">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return pageMetadata("configure", lang, { title: t.configurator.title, description: t.pages.configure.intro });
}

export default async function DesignPage({ params }: PageProps<"/[lang]/design">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  const products = await getProducts();
  const modelMeta = Object.fromEntries(
    products.map((p) => [
      p.slug,
      {
        capacity: t.collection.capacity.replace("{count}", String(p.capacity)),
        price: t.configurator.price.replace("{price}", formatPrice(p.priceFromCents, lang)),
      },
    ]),
  );

  return (
    <>
      <noscript>
        <p className="container-page py-section text-body">{t.configurator.webglHelp}</p>
      </noscript>
      <ConfiguratorLoader locale={lang} t={t.configurator} modelMeta={modelMeta} />
    </>
  );
}

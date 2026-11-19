import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/catalog/catalog-data";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/lib/page-metadata";
import { Reveal } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product/product-card";

export async function generateMetadata({ params }: PageProps<"/[lang]/collection">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return pageMetadata("collection", lang, { title: t.collection.title, description: t.collection.intro });
}

export default async function CollectionPage({ params }: PageProps<"/[lang]/collection">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const products = await getProducts();

  return (
    <div className="container-page py-section">
      <Reveal className="mb-[clamp(32px,4vw,56px)] max-w-3xl">
        <h1 className="text-h1 font-bold text-accent">{t.collection.title}</h1>
        <p className="mt-5 text-[17px] leading-[1.65] text-body md:text-lead">{t.collection.intro}</p>
      </Reveal>
      <ul className="grid grid-cols-1 gap-x-[clamp(20px,2.4vw,32px)] gap-y-14 md:grid-cols-2">
        {products.map((product, i) => (
          <li key={product.slug}>
            <Reveal delay={i * 0.08}>
              <ProductCard product={product} locale={lang} t={t} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}

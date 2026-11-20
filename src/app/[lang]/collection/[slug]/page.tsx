import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getProducts } from "@/catalog/catalog-data";
import { getProduct, isProductSlug, products } from "@/catalog/products";
import { site } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { formatPrice } from "@/lib/format";
import { pageMetadata } from "@/lib/page-metadata";
import { PhotoBand } from "@/components/home/photo-band";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductSpecs } from "@/components/product/product-specs";
import { Button } from "@/components/ui/button";
import { ChevronIcon } from "@/components/ui/icons";

export function generateStaticParams() {
  return locales.flatMap((lang) => products.map((p) => ({ lang, slug: p.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/collection/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isProductSlug(slug)) return {};
  const t = await getDictionary(lang);
  const product = getProduct(slug);
  const meta = pageMetadata("collection", lang, {
    title: product.name,
    description: t.product.models[slug].metaDescription,
    segments: [slug],
  });
  return { ...meta, openGraph: { ...meta.openGraph, images: [product.images[0].src.src] } };
}

export default async function ProductPage({ params }: PageProps<"/[lang]/collection/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isProductSlug(slug)) notFound();
  const t = await getDictionary(lang);
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const model = t.product.models[slug];
  const other = (await getProducts()).find((p) => p.slug !== slug);
  const otherImage = other?.images[0];

  // Structured data for search engines. No offer/price until prices are decided.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: model.description,
    image: product.images.map((img) => new URL(img.src.src, site.url).toString()),
    brand: { "@type": "Brand", name: site.name },
    ...(product.priceFromCents !== null && {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: (product.priceFromCents / 100).toFixed(2),
        availability: "https://schema.org/MadeToOrder",
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="container-page grid grid-cols-1 gap-x-[clamp(32px,4vw,72px)] gap-y-10 pt-8 pb-section md:pt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ProductGallery
          images={product.images.map((img) => ({ src: img.src, alt: img.alt[lang] }))}
          label={t.product.gallery.replace("{name}", product.name)}
        />

        <div className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-3">
            <Link
              href={href("collection", lang)}
              className="group inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-accent hover:text-accent-strong"
            >
              <ChevronIcon size={12} className="rotate-180 transition-transform group-hover:-translate-x-0.5" />
              {t.product.breadcrumb}
            </Link>
            <h1 className="text-h1 font-bold">{product.name}</h1>
            <p className="text-band-sub font-light text-body">{model.subtitle}</p>
            <p className="text-[15px] text-muted">
              {t.home.bands.from.replace("{price}", formatPrice(product.priceFromCents, lang))}
            </p>
          </div>

          <p className="leading-relaxed text-body">{model.description}</p>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full">
              <Link href={`${href("configure", lang)}?model=${product.slug}`}>
                {t.product.cta.replace("{name}", product.name)}
              </Link>
            </Button>
            <p className="text-[15px] text-muted">{t.product.ctaNote}</p>
          </div>

          <ProductSpecs product={product} locale={lang} t={t} />
        </div>
      </div>

      {other && otherImage && (
      <section aria-label={t.product.other}>
        <PhotoBand
          image={otherImage.src}
          alt={otherImage.alt[lang]}
          title={other.name}
          subtitle={t.product.models[other.slug].subtitle}
          meta={t.home.bands.from.replace("{price}", formatPrice(other.priceFromCents, lang))}
          link={{ label: t.collection.view.replace("{name}", other.name), href: href("collection", lang, other.slug) }}
          focus={other.bandFocus}
        />
      </section>
      )}
    </>
  );
}

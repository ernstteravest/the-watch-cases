import { notFound } from "next/navigation";
import { getProducts } from "@/catalog/catalog-data";
import { features, site } from "@/config/site";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { formatPrice } from "@/lib/format";
import { CollectionNav } from "@/components/home/collection-nav";
import { ConfiguratorTeaser } from "@/components/home/configurator-teaser";
import { Hero } from "@/components/home/hero";
import { Intro } from "@/components/home/intro";
import { MoreFrom } from "@/components/home/more-from";
import { Newsletter } from "@/components/home/newsletter";
import { PhotoBand } from "@/components/home/photo-band";
import { Process } from "@/components/home/process";
import { ReadyMadeDesigns } from "@/components/home/ready-made-designs";
import { Reassurance } from "@/components/home/reassurance";
import bandDuo from "@/assets/images/home/band-duo.jpg";
import bandQuartet from "@/assets/images/home/band-quartet-slim.jpg";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  const b = t.home.bands;
  const products = await getProducts();
  const duo = products.find((p) => p.slug === "duo");
  const quartet = products.find((p) => p.slug === "quartet-slim");

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    email: site.email,
    address: { "@type": "PostalAddress", addressLocality: site.city, addressCountry: site.country },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }}
      />
      <Hero locale={lang} t={t} />
      <Reassurance t={t} />
      <Intro t={t} />
      <CollectionNav locale={lang} t={t} />
      {duo && (
        <PhotoBand
          id="duo"
          image={bandDuo}
          alt={b.duo.alt}
          title={duo.name}
          subtitle={b.duo.subtitle}
          meta={b.from.replace("{price}", formatPrice(duo.priceFromCents, lang))}
          link={{ label: b.more, href: href("collection", lang, duo.slug) }}
        />
      )}
      {quartet && (
        <PhotoBand
          id="quartet-slim"
          image={bandQuartet}
          alt={b.quartetSlim.alt}
          title={quartet.name}
          subtitle={b.quartetSlim.subtitle}
          meta={b.from.replace("{price}", formatPrice(quartet.priceFromCents, lang))}
          link={{ label: b.more, href: href("collection", lang, quartet.slug) }}
        />
      )}
      <ConfiguratorTeaser locale={lang} t={t} />
      {features.readyMadeDesigns && <ReadyMadeDesigns locale={lang} t={t} />}
      <Process locale={lang} t={t} />
      <MoreFrom locale={lang} t={t} />
      {features.newsletter && <Newsletter t={t} locale={lang} />}
    </>
  );
}

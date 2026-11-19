import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/catalog/products";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { formatPrice } from "@/lib/format";
import { ChevronIcon } from "@/components/ui/icons";

/** Large card on the collection page. */
export function ProductCard({ product, locale, t }: { product: Product; locale: Locale; t: Dictionary }) {
  const image = product.images[0];
  const model = t.product.models[product.slug];
  return (
    <Link href={href("collection", locale, product.slug)} className="group flex flex-col gap-4">
      <span className="block overflow-hidden rounded-card bg-walnut">
        <Image
          src={image.src}
          alt={image.alt[locale]}
          placeholder="blur"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/3] w-full object-cover object-[70%_50%] transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
        />
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-h3 font-bold group-hover:text-accent">{product.name}</span>
          <span className="text-body">
            {t.home.bands.from.split(",")[0].replace("{price}", formatPrice(product.priceFromCents, locale))}
          </span>
        </span>
        <span className="text-lg font-light text-body">{model.subtitle}</span>
        <span className="text-[15px] text-muted">
          {t.collection.capacity.replace("{count}", String(product.capacity))}
        </span>
      </span>
      <span className="inline-flex min-h-9 items-center gap-2 font-semibold text-accent group-hover:text-accent-strong">
        {t.collection.view.replace("{name}", product.name)}
        <ChevronIcon className="transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

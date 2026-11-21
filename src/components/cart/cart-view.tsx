"use client";

import Link from "@/components/ui/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { catalogResult, surfaceSwatchHex } from "@/configurator/catalog";
import { createLabels } from "@/configurator/labels";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { getLogo, removeFromCart, setQuantity, MAX_QUANTITY, type CartLine } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/use-cart";
import { formatPrice } from "@/lib/format";
import { isProductEnabled } from "@/catalog/availability";
import { describeDesign } from "@/components/configurator/describe";
import { OneColourThumb } from "@/components/configurator/logo-field";
import { Button } from "@/components/ui/button";

type Props = {
  locale: Locale;
  t: Dictionary["cart"];
  summaryTexts: Pick<Dictionary["configurator"], "summary" | "summaryName" | "logo">;
  /** Price per model in cents (incl. VAT); null = not decided yet. */
  prices: Record<string, number | null>;
  links: { checkout: string; configure: string; collection: string };
};

function LogoThumb({
  id,
  label,
  missing,
  logo,
  inkHex,
}: {
  id: string;
  label: string;
  missing: string;
  logo: { width: number; height: number };
  /** One-colour print: draw the logo in this ink, as it will be printed. */
  inkHex: string | null;
}) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getLogo(id)
      .then((l) => alive && setSrc(l?.preview ?? null))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [id]);
  if (src === undefined) return null;
  if (src === null) return <p className="text-sm font-semibold text-accent">{missing}</p>;
  if (inkHex) {
    return (
      <span className="inline-grid h-10 w-[140px] place-items-center rounded-[2px] bg-ink/80 p-1">
        <OneColourThumb
          artwork={{ dataUrl: src, width: logo.width, height: logo.height }}
          color={{ hex: inkHex }}
          label={label}
          className="max-h-8 max-w-full object-contain"
        />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local data URL from the browser's storage
    <img src={src} alt={label} className="h-10 w-auto max-w-[140px] rounded-[2px] bg-sand object-contain p-1" />
  );
}

export function CartView({ locale, t, summaryTexts, prices, links }: Props) {
  const lines = useCart();
  const catalog = catalogResult.ok ? catalogResult.value : null;
  const labels = useMemo(() => (catalog ? createLabels(catalog, locale) : null), [catalog, locale]);

  // The browser has the cart; render nothing until it's read (avoids a flash of "empty").
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!ready || !catalog || !labels) return <div className="min-h-[40vh]" aria-busy="true" />;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="text-lead text-body">{t.empty}</p>
        <Button asChild size="lg">
          <Link href={links.configure}>{t.emptyCta}</Link>
        </Button>
      </div>
    );
  }

  const unit = (l: CartLine) => prices[l.configuration.product] ?? null;
  const allPriced = lines.every((l) => unit(l) !== null);
  const subtotal = allPriced ? lines.reduce((sum, l) => sum + (unit(l) as number) * l.quantity, 0) : null;
  const hasLogo = lines.some((l) => l.logo);

  return (
    <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ul className="border-t border-line">
        {lines.map((line) => {
          const c = line.configuration;
          const price = unit(line);
          return (
            <li key={line.id} className="flex flex-col gap-4 border-b border-line py-6 sm:flex-row sm:items-start">
              <div aria-hidden="true" className="flex flex-none gap-1.5">
                <span className="size-10 rounded-pill border border-ink/10" style={{ background: surfaceSwatchHex(catalog, "exterior", c.exterior) }} />
                <span className="size-10 rounded-pill border border-ink/10" style={{ background: surfaceSwatchHex(catalog, "interior", c.interior) }} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-[15px] leading-snug">
                  {describeDesign(
                    catalog,
                    labels,
                    summaryTexts,
                    c,
                    line.logo ? { mode: line.logo.mode, color: line.logo.color, name: line.logo.name } : null,
                  )}
                </p>
                {!isProductEnabled(c.product) && <p className="text-sm font-semibold text-accent">{t.unavailable}</p>}
                {line.logo && (
                  <LogoThumb
                    id={line.id}
                    label={line.logo.name}
                    missing={t.logoMissing}
                    logo={line.logo}
                    inkHex={
                      line.logo.mode === "one-color"
                        ? (catalog.logo.colors.find((x) => x.id === line.logo?.color)?.hex ?? null)
                        : null
                    }
                  />
                )}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="inline-flex items-center rounded-pill border border-line-strong" role="group" aria-label={t.quantity}>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.id, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label={t.decrease}
                      className="grid size-10 cursor-pointer place-items-center text-lg disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center tabular-nums" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      disabled={line.quantity >= MAX_QUANTITY}
                      aria-label={t.increase}
                      className="grid size-10 cursor-pointer place-items-center text-lg disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <a href={line.designUrl} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
                    {t.edit}
                  </a>
                  <button
                    type="button"
                    onClick={() => void removeFromCart(line.id)}
                    className="cursor-pointer text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    {t.remove}
                  </button>
                </div>
              </div>
              <div className="text-right sm:min-w-28">
                <p className="font-semibold tabular-nums">{formatPrice(price === null ? null : price * line.quantity, locale)}</p>
                {line.quantity > 1 && (
                  <p className="text-sm text-muted tabular-nums">
                    {formatPrice(price, locale)} {t.each}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="flex h-fit flex-col gap-4 rounded-card bg-sand p-6 lg:sticky lg:top-8">
        <dl className="flex flex-col gap-2 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt>{t.subtotal}</dt>
            <dd className="font-semibold tabular-nums">{formatPrice(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t.shipping}</dt>
            <dd className="text-right text-muted">{t.shippingNote}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted">{t.priceNote}</p>
        {hasLogo && <p className="text-sm text-body">{t.logoReview}</p>}
        <Button asChild size="lg" className="w-full">
          <Link href={links.checkout}>{t.checkout}</Link>
        </Button>
        <Link href={links.collection} className="self-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
          {t.continue}
        </Link>
      </aside>
    </div>
  );
}

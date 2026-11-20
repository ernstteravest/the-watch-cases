"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { placeOrder, quoteCheckout, startPayment, type PlaceOrderResult, type QuoteSummary } from "@/app/actions/checkout";
import { catalogResult } from "@/configurator/catalog";
import { createLabels } from "@/configurator/labels";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { getLogo, type CartLine } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/use-cart";
import { formatPrice } from "@/lib/format";
import { SHIPPING_COUNTRIES, type CheckoutForm as FormValues } from "@/lib/orders/checkout-schema";
import { describeDesign } from "@/components/configurator/describe";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type T = Dictionary["checkout"];
type Address = { name: string; line1: string; line2: string; postalCode: string; city: string; country: (typeof SHIPPING_COUNTRIES)[number] };

const emptyAddress: Address = { name: "", line1: "", line2: "", postalCode: "", city: "", country: "NL" };

/** What the server needs per cart line: the design, quantity and logo file info (not the file). */
const toServerLines = (lines: CartLine[]) =>
  lines.map((l) => ({
    configuration: l.configuration,
    quantity: l.quantity,
    logo: l.logo ? { name: l.logo.name, format: l.logo.format, width: l.logo.width, height: l.logo.height } : null,
  }));

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-card border border-line-strong bg-paper px-4 text-base text-ink aria-invalid:border-accent focus-visible:outline-2 focus-visible:outline-accent";

export function CheckoutForm({
  locale,
  t,
  summaryTexts,
  prices,
  links,
  extraLabels,
}: {
  locale: Locale;
  t: T;
  summaryTexts: Pick<Dictionary["configurator"], "summary" | "summaryName" | "logo">;
  prices: Record<string, number | null>;
  links: { terms: string; cart: string };
  /** From the cart texts: "Verzending" and "Winkelmand". */
  extraLabels: { shipping: string; cart: string };
}) {
  const uid = useId();
  const lines = useCart();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const catalog = catalogResult.ok ? catalogResult.value : null;
  const labels = useMemo(() => (catalog ? createLabels(catalog, locale) : null), [catalog, locale]);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [shipping, setShipping] = useState<Address>(emptyAddress);
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<Address>(emptyAddress);
  const [company, setCompany] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "working" | "uploading" | "redirecting">("idle");
  const [summary, setSummary] = useState<QuoteSummary | null>(null);
  const cancelled = ready && new URLSearchParams(window.location.search).has("cancelled");

  // Totals from the server whenever the cart or the delivery country changes.
  const serverLines = useMemo(() => toServerLines(lines), [lines]);
  useEffect(() => {
    if (!ready || serverLines.length === 0) return;
    let alive = true;
    quoteCheckout(serverLines, shipping.country).then((r) => alive && setSummary(r));
    return () => {
      alive = false;
    };
  }, [ready, serverLines, shipping.country]);

  if (!ready || !catalog || !labels) return <div className="min-h-[40vh]" aria-busy="true" />;
  if (lines.length === 0) {
    return (
      <p className="text-lead text-body">
        {t.notices.EMPTY_CART}{" "}
        <Link href={links.cart} className="font-semibold text-accent underline underline-offset-4">
          {extraLabels.cart}
        </Link>
      </p>
    );
  }

  const err = (key: string) => (errors[key] ? (t.errors as Record<string, string>)[errors[key]] ?? t.errors.required : undefined);
  const a11y = (key: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${uid}-${key}-error` : undefined,
  });
  const quoteNotice =
    summary && !summary.ok ? ((t.notices as Record<string, string>)[summary.error.code] ?? t.notices.UNAVAILABLE) : null;

  const handleResult = async (result: PlaceOrderResult) => {
    switch (result.status) {
      case "invalid":
        setErrors(result.fields);
        setNotice(t.errors.fix);
        setStage("idle");
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
        return;
      case "quote_error":
        setNotice((t.notices as Record<string, string>)[result.error.code] ?? t.notices.UNAVAILABLE);
        setStage("idle");
        return;
      case "payments_unavailable":
        setNotice(t.notices.payments);
        setStage("idle");
        return;
      case "upload_logos": {
        setStage("uploading");
        try {
          for (const u of result.uploads) {
            const files = await getLogo(lines[u.line].id);
            if (!files) throw new Error("logo missing");
            const preview = await (await fetch(files.preview)).blob();
            for (const [url, blob] of [
              [u.original, files.original],
              [u.preview, preview],
            ] as const) {
              const res = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream" } });
              if (!res.ok) throw new Error(`upload ${res.status}`);
            }
          }
        } catch {
          setNotice(t.notices.upload);
          setStage("idle");
          return;
        }
        await handleResult(await startPayment(result.orderId));
        return;
      }
      case "redirect":
        setStage("redirecting");
        window.location.href = result.url;
        return;
      default:
        setNotice(t.notices.error);
        setStage("idle");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setNotice(null);
    setStage("working");
    const form: FormValues = {
      locale,
      email,
      firstName,
      lastName,
      phone,
      shipping,
      billingSameAsShipping: billingSame,
      billing: billingSame ? undefined : billing,
      company,
      vatNumber,
      acceptTerms: acceptTerms as true,
    };
    try {
      await handleResult(await placeOrder(form, serverLines, lines.map((l) => l.designUrl)));
    } catch {
      setNotice(t.notices.error);
      setStage("idle");
    }
  };

  const addressFields = (prefix: "shipping" | "billing", value: Address, set: (a: Address) => void) => {
    const id = (k: string) => `${uid}-${prefix}.${k}`;
    const input = (k: keyof Address, autoComplete: string, required = true) => (
      <input
        id={id(k)}
        className={inputClass}
        value={value[k]}
        required={required}
        autoComplete={`${prefix === "billing" ? "billing" : "shipping"} ${autoComplete}`}
        onChange={(e) => set({ ...value, [k]: e.target.value })}
        {...a11y(`${prefix}.${k}`)}
      />
    );
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={id("name")} label={t.name} error={err(`${prefix}.name`)} className="sm:col-span-2">
          {input("name", "name")}
        </Field>
        <Field id={id("line1")} label={t.line1} error={err(`${prefix}.line1`)} className="sm:col-span-2">
          {input("line1", "address-line1")}
        </Field>
        <Field id={id("line2")} label={t.line2} error={err(`${prefix}.line2`)} className="sm:col-span-2">
          {input("line2", "address-line2", false)}
        </Field>
        <Field id={id("postalCode")} label={t.postalCode} error={err(`${prefix}.postalCode`)}>
          {input("postalCode", "postal-code")}
        </Field>
        <Field id={id("city")} label={t.city} error={err(`${prefix}.city`)}>
          {input("city", "address-level2")}
        </Field>
        <Field id={id("country")} label={t.country} error={err(`${prefix}.country`)} className="sm:col-span-2">
          <select
            id={id("country")}
            className={inputClass}
            value={value.country}
            autoComplete={`${prefix === "billing" ? "billing" : "shipping"} country`}
            onChange={(e) => set({ ...value, country: e.target.value as Address["country"] })}
          >
            {SHIPPING_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t.countries[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    );
  };

  const busy = stage !== "idle";
  const totals = summary?.ok ? summary : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-10">
        {(cancelled || quoteNotice || notice) && (
          <div role="alert" className="flex flex-col gap-1 rounded-card border border-accent/30 bg-sand p-4 text-[15px]">
            {cancelled && !notice && <p>{t.notices.cancelled}</p>}
            {quoteNotice && <p className="font-semibold">{quoteNotice}</p>}
            {notice && notice !== quoteNotice && <p className="font-semibold">{notice}</p>}
          </div>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 text-h3 font-bold">{t.contact}</legend>
          <Field id={`${uid}-email`} label={t.email} error={err("email")}>
            <input id={`${uid}-email`} type="email" className={inputClass} value={email} autoComplete="email" required onChange={(e) => setEmail(e.target.value)} {...a11y("email")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${uid}-firstName`} label={t.firstName} error={err("firstName")}>
              <input id={`${uid}-firstName`} className={inputClass} value={firstName} autoComplete="given-name" required onChange={(e) => setFirstName(e.target.value)} {...a11y("firstName")} />
            </Field>
            <Field id={`${uid}-lastName`} label={t.lastName} error={err("lastName")}>
              <input id={`${uid}-lastName`} className={inputClass} value={lastName} autoComplete="family-name" required onChange={(e) => setLastName(e.target.value)} {...a11y("lastName")} />
            </Field>
          </div>
          <Field id={`${uid}-phone`} label={t.phone} error={err("phone")}>
            <input id={`${uid}-phone`} type="tel" className={inputClass} value={phone} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} {...a11y("phone")} />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 text-h3 font-bold">{t.shippingTitle}</legend>
          {addressFields("shipping", shipping, setShipping)}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{t.billingTitle}</legend>
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} className="mt-1 size-4 accent-accent" />
            {t.billingSame}
          </label>
          {!billingSame && (
            <>
              <h2 className="mt-2 text-h3 font-bold">{t.billingTitle}</h2>
              {addressFields("billing", billing, setBilling)}
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 text-h3 font-bold">{t.business}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={`${uid}-company`} label={t.company} error={err("company")}>
              <input id={`${uid}-company`} className={inputClass} value={company} autoComplete="organization" onChange={(e) => setCompany(e.target.value)} {...a11y("company")} />
            </Field>
            <Field id={`${uid}-vatNumber`} label={t.vatNumber} error={err("vatNumber")}>
              <input id={`${uid}-vatNumber`} className={inputClass} value={vatNumber} placeholder="NL123456789B01" onChange={(e) => setVatNumber(e.target.value)} {...a11y("vatNumber")} />
            </Field>
          </div>
        </fieldset>
      </div>

      <aside className="flex h-fit flex-col gap-5 rounded-card bg-sand p-6 lg:sticky lg:top-8">
        <h2 className="text-h3 font-bold">{t.summary}</h2>
        <ul className="flex flex-col gap-3 border-b border-line-strong pb-4 text-[15px]">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-4">
              <span>
                {l.quantity} ×{" "}
                {describeDesign(
                  catalog,
                  labels,
                  summaryTexts,
                  l.configuration,
                  l.logo ? { mode: l.logo.mode, color: l.logo.color, name: l.logo.name } : null,
                )}
              </span>
              <span className="whitespace-nowrap tabular-nums">
                {formatPrice(prices[l.configuration.product] == null ? null : (prices[l.configuration.product] as number) * l.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 text-[15px]">
          <div className="flex justify-between">
            <dt>
              {extraLabels.shipping} ({t.countries[shipping.country]})
            </dt>
            <dd className="tabular-nums">{totals ? (totals.shippingCents === 0 ? t.free : formatPrice(totals.shippingCents, locale)) : "–"}</dd>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <dt>{t.total}</dt>
            <dd className="tabular-nums">{formatPrice(totals ? totals.totalCents : null, locale)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
            <input
              id={`${uid}-acceptTerms`}
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 size-4 accent-accent"
              {...a11y("acceptTerms")}
            />
            <span>
              {t.termsBefore}
              <a href={links.terms} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
                {t.termsLink}
              </a>
              {t.termsAfter}
            </span>
          </label>
          {err("acceptTerms") && (
            <p id={`${uid}-acceptTerms-error`} className="text-sm font-semibold text-accent">
              {err("acceptTerms")}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={busy} className="w-full whitespace-normal">
          {stage === "uploading" ? t.uploading : stage === "redirecting" ? t.redirecting : stage === "working" ? t.working : t.pay}
        </Button>
        <p className="text-sm text-muted">{t.payNote}</p>
      </aside>
    </form>
  );
}

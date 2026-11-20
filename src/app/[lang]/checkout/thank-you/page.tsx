import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { ThankYou } from "@/components/checkout/thank-you";
import { TextLink } from "@/components/ui/text-link";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout/thank-you">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.checkout.thanks.title, robots: { index: false, follow: false } };
}

export default async function ThankYouPage({ params }: PageProps<"/[lang]/checkout/thank-you">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <div className="container-page py-section">
      <h1 className="mb-6 text-h1 font-bold text-accent">{t.checkout.thanks.title}</h1>
      <ThankYou texts={t.checkout.thanks} />
      <TextLink href={href("home", lang)} className="mt-6">
        {t.pages.backHome}
      </TextLink>
    </div>
  );
}

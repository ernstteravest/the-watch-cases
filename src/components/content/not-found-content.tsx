"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { parsePublicPath } from "@/i18n/routes";
import { ChevronIcon } from "@/components/ui/icons";

type LinkText = { label: string; href: string };
type Texts = Record<Locale, { title: string; intro: string; home: LinkText; collection: LinkText }>;

export function NotFoundContent({ texts }: { texts: Texts }) {
  const { locale } = parsePublicPath(usePathname() ?? "/");
  const t = texts[locale];
  return (
    <article className="container-page py-section">
      <div className="max-w-3xl">
        <p className="eyebrow mb-3">404</p>
        <h1 className="text-h1 font-bold text-accent">{t.title}</h1>
        <p className="mt-6 text-[17px] leading-[1.65] text-body md:text-lead">{t.intro}</p>
        <div className="mt-6 flex flex-wrap gap-x-8">
          {[t.home, t.collection].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:text-accent-strong"
            >
              {link.label}
              <ChevronIcon className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

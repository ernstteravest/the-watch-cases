"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/routes";
import { cn } from "@/lib/utils";

/** Shows the other language ("EN" on Dutch pages) and links to the same page in it. */
export function LanguageSwitch({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  const target: Locale = locale === "nl" ? "en" : "nl";
  return (
    <Link
      href={switchLocalePath(pathname, target)}
      hrefLang={target}
      lang={target}
      aria-label={label}
      className={cn("grid min-h-11 min-w-11 place-items-center text-[13px] font-semibold hover:text-accent", className)}
    >
      {target.toUpperCase()}
    </Link>
  );
}

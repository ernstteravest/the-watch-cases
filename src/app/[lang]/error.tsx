"use client";

import Link from "@/components/ui/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { parsePublicPath } from "@/i18n/routes";
import { Button } from "@/components/ui/button";

const texts = {
  nl: {
    title: "Er ging iets mis",
    body: "Deze pagina kon niet worden geladen. Probeer het opnieuw; lukt het niet, ga dan terug naar de homepage.",
    retry: "Opnieuw proberen",
    home: "Naar de homepage",
  },
  en: {
    title: "Something went wrong",
    body: "This page couldn’t be loaded. Please try again; if that doesn’t work, go back to the homepage.",
    retry: "Try again",
    home: "Go to the homepage",
  },
} as const;

/** Unexpected errors: shown inside the site layout, in the visitor's language. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = parsePublicPath(usePathname() ?? "/");
  const t = texts[locale];
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-section">
      <div className="max-w-2xl">
        <h1 className="text-h1 font-bold text-accent">{t.title}</h1>
        <p className="mt-6 text-[17px] leading-[1.65] text-body md:text-lead">{t.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button type="button" onClick={reset}>
            {t.retry}
          </Button>
          <Link href={locale === "en" ? "/en" : "/"} className="font-semibold text-accent underline-offset-4 hover:underline">
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

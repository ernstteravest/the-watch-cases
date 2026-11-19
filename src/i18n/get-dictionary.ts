import "server-only";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/nl";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  nl: () => import("./dictionaries/nl").then((m) => m.default),
  en: () => import("./dictionaries/en").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

export type { Dictionary };

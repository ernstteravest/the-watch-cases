/**
 * Translated names for the ids in config/options.ts.
 *
 * Adding a colour, leather or piece later? Add its translations here.
 * If you forget, the site shows the `name`/`label` from options.ts instead,
 * so nothing breaks.
 */
import { MATCH_PREFIX, type Catalog, type Issue } from "./catalog";
import type { Locale } from "@/i18n/config";

type Names = Record<string, Partial<Record<Locale, string>>>;

const colors: Names = {
  "money-green": { nl: "Money green", en: "Money green" },
  cognac: { nl: "Cognac", en: "Cognac" },
  black: { nl: "Zwart", en: "Black" },
  "dark-brown": { nl: "Donkerbruin", en: "Dark brown" },
  navy: { nl: "Navy", en: "Navy" },
  "signal-orange": { nl: "Signaaloranje", en: "Signal orange" },
  "light-blue": { nl: "Lichtblauw", en: "Light blue" },
  beige: { nl: "Beige", en: "Beige" },
  red: { nl: "Rood", en: "Red" },
};

const materials: Names = {
  "full-grain": { nl: "Volnerf leer", en: "Full-grain leather" },
  nappa: { nl: "Glad nappaleer", en: "Smooth nappa leather" },
  suede: { nl: "Suède", en: "Suede" },
};

const pieces: Names = {
  cushions: { nl: "Horlogekussens", en: "Watch cushions" },
  pocket: { nl: "Vak in het deksel", en: "Lid pocket" },
  flap: { nl: "Flap van het vak", en: "Lid flap" },
  strap: { nl: "Lipje", en: "Lid strap" },
  "snap-cap": { nl: "Drukknoop", en: "Snap cap" },
  "zip-pull": { nl: "Ritstrekker", en: "Zip pull tab" },
};

const views: Names = {
  open: { nl: "Open", en: "Open" },
  closed: { nl: "Gesloten", en: "Closed" },
  top: { nl: "Bovenkant", en: "Top" },
  front: { nl: "Voorkant", en: "Front" },
  side: { nl: "Zijkant", en: "Side" },
};

const surfaces: Names = { exterior: { nl: "Buitenkant", en: "Exterior" }, interior: { nl: "Binnenkant", en: "Interior" } };

export function createLabels(catalog: Catalog, locale: Locale) {
  const pick = (table: Names, id: string, fallback: string) => table[id]?.[locale] ?? fallback;

  const color = (id: string) => pick(colors, id, catalog.colors.find((c) => c.id === id)?.name ?? id);
  const material = (id: string) => pick(materials, id, catalog.materials.find((m) => m.id === id)?.name ?? id);
  const piece = (id: string) => pick(pieces, id, catalog.pieces.find((p) => p.id === id)?.label ?? id);
  const view = (id: string) => pick(views, id, catalog.presentation.views.find((v) => v.id === id)?.label ?? id);
  const surface = (id: "exterior" | "interior") => pick(surfaces, id, catalog[id].label);

  /** "Same as interior" / "Gelijk aan binnenkant" for match:… tokens. */
  const match = (token: string) => {
    const target = token.slice(MATCH_PREFIX.length);
    const name = target === "exterior" || target === "interior" ? surface(target) : piece(target);
    return locale === "nl" ? `Gelijk aan ${name.toLowerCase()}` : `Same as ${name.toLowerCase()}`;
  };

  /** Customer-facing message for a personalization issue (by code, not by English text). */
  const personalizationIssue = (issue: Issue, max: number, length: number): string => {
    const nl = locale === "nl";
    switch (issue.code) {
      case "too_long":
        return nl ? `Maximaal ${max} tekens (nu ${length}).` : `Use at most ${max} characters (currently ${length}).`;
      case "too_short":
        return nl ? "Gebruik minstens één teken." : "Use at least one character.";
      case "invalid_characters": {
        const chars = issue.message.match(/Not allowed: (.*?)\. /)?.[1] ?? "";
        const list = nl ? chars.replace(/\bspace\b/g, "spatie") : chars;
        return nl ? `Niet toegestaan: ${list}.` : `Not allowed: ${list}.`;
      }
      default:
        return nl ? "Gravering is nu niet beschikbaar." : "Engraving is not available right now.";
    }
  };

  return { color, material, piece, view, surface, match, personalizationIssue };
}

export type Labels = ReturnType<typeof createLabels>;

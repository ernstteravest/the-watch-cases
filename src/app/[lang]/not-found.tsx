import en from "@/i18n/dictionaries/en";
import nl from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { NotFoundContent } from "@/components/content/not-found-content";

/**
 * 404 inside the site layout (header and footer stay). not-found receives no
 * params, so both languages are passed and the client picks one from the URL.
 */
export default function NotFound() {
  const texts = {
    nl: {
      ...nl.pages.notFound,
      home: { label: nl.pages.backHome, href: href("home", "nl") },
      collection: { label: nl.collection.title, href: href("collection", "nl") },
    },
    en: {
      ...en.pages.notFound,
      home: { label: en.pages.backHome, href: href("home", "en") },
      collection: { label: en.collection.title, href: href("collection", "en") },
    },
  };
  return <NotFoundContent texts={texts} />;
}

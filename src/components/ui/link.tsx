import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * Next.js Link with one exception: Dutch addresses of a single segment
 * (/contact, /cadeaus, …) are not prefetched. Our Dutch URLs have no
 * language prefix, and Next's router would otherwise mistake them for the
 * language segment (/[lang]) and request data that doesn't exist (404s in
 * the console). Those pages are simply loaded on click instead.
 */
export function isAmbiguousDutchPath(href: unknown): boolean {
  if (typeof href !== "string") return false;
  const path = href.split(/[?#]/)[0];
  return /^\/[^/]+$/.test(path) && path !== "/en";
}

export default function Link(props: ComponentProps<typeof NextLink>) {
  const prefetch = props.prefetch ?? (isAmbiguousDutchPath(props.href) ? false : undefined);
  return <NextLink {...props} prefetch={prefetch} />;
}

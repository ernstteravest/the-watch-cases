import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { connection } from "next/server";
import "../globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Beheer", template: "%s · Beheer · The Watch Cases" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

export const viewport: Viewport = { themeColor: "#1E1611" };

/**
 * Root layout of the management environment: separate from the public
 * website (no header, footer or shop), same fonts and colours.
 */
export default async function BeheerLayout({ children }: LayoutProps<"/beheer">) {
  // Rendered per request, so every page carries this request's CSP nonce
  // and nothing from /beheer is ever stored in a shared cache.
  await connection();
  return (
    <html lang="nl" className={archivo.variable}>
      <body className="min-h-dvh bg-sand text-ink antialiased">{children}</body>
    </html>
  );
}

// Every page is rendered at request time behind a login; skip the
// instant-navigation (static shell) checks for this part of the site.
export const instant = false;

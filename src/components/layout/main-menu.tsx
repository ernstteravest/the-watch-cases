"use client";

import Link from "@/components/ui/link";
import { useState, type ReactNode } from "react";
import type { NavItem } from "@/config/navigation";
import { Logo } from "@/components/brand/logo";
import { MenuIcon } from "@/components/ui/icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MainMenuProps = {
  primary: NavItem[];
  secondary: NavItem[];
  homeHref: string;
  labels: { open: string; close: string; title: string; home: string };
  footer: { email: string; location: string };
  /** Shown in the panel on phones, where the header has no room for it. */
  languageSwitch: ReactNode;
};

/** The menu behind the icon in the header; the same panel on desktop and mobile, as in the design. */
export function MainMenu({ primary, secondary, homeHref, labels, footer, languageSwitch }: MainMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={labels.open}
        className="grid size-11 cursor-pointer place-items-center justify-self-start text-ink hover:text-accent"
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" closeLabel={labels.close}>
        <SheetTitle className="sr-only">{labels.title}</SheetTitle>
        <SheetDescription className="sr-only">{labels.title}</SheetDescription>
        <div className="flex h-[68px] items-center px-6">
          <Link href={homeHref} onClick={close}>
            <Logo label={labels.home} />
          </Link>
        </div>
        <nav aria-label={labels.title} className="flex flex-1 flex-col overflow-y-auto px-6 pt-6 pb-8">
          <ul className="flex flex-col">
            {primary.map((item) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-14 items-center text-[22px] font-semibold tracking-[-0.01em] hover:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-8 flex flex-col gap-1">
            {secondary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  className="flex min-h-11 items-center text-base text-body hover:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-line pt-6 text-[15px] text-muted">
            <a href={`mailto:${footer.email}`} className="block hover:text-accent">
              {footer.email}
            </a>
            <p className="mt-1">{footer.location}</p>
            <div className="mt-3 sm:hidden" onClick={close}>
              {languageSwitch}
            </div>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

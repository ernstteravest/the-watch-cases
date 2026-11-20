"use client";

import Link from "next/link";
import { cartCount } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/use-cart";
import { BagIcon } from "@/components/ui/icons";

/** Bag icon with the number of items; the count comes from the browser's cart. */
export function CartLink({ href, labelOne, labelMany }: { href: string; labelOne: string; labelMany: string }) {
  const count = cartCount(useCart());
  const label = count === 1 ? labelOne : labelMany.replace("{count}", String(count));
  return (
    <Link href={href} aria-label={label} className="relative grid size-11 place-items-center hover:text-accent">
      <BagIcon />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1 grid min-w-[18px] place-items-center rounded-pill bg-accent px-1 text-[11px] leading-[18px] font-bold text-paper"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

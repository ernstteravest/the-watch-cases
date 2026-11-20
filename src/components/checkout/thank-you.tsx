"use client";

import { useEffect, useState } from "react";
import { clearCart } from "@/lib/cart/cart";

/**
 * Shown after Stripe sends the customer back. The order number comes from
 * the return link; the actual payment status is only trusted from the
 * verified webhook, so this page doesn't claim the payment succeeded.
 */
export function ThankYou({ texts }: { texts: { body: string; noOrder: string; production: string } }) {
  const [order, setOrder] = useState<string | null>(null);
  useEffect(() => {
    const number = new URLSearchParams(window.location.search).get("order");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL after hydration
    setOrder(number && /^TWC-\d{4}-\d{4,}$/.test(number) ? number : null);
    void clearCart();
  }, []);

  return (
    <div className="flex max-w-2xl flex-col gap-4 text-[17px] leading-relaxed text-body md:text-lead">
      <p>{order ? texts.body.replace("{order}", order) : texts.noOrder}</p>
      <p>{texts.production}</p>
    </div>
  );
}

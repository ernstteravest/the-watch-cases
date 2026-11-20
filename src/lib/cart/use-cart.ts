"use client";

import { useSyncExternalStore } from "react";
import { cartStore, type CartLine } from "./cart";

/** Current cart lines; empty during server rendering, filled in the browser. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
}

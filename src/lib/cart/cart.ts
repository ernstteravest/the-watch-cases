"use client";

/**
 * The shopping cart lives in the visitor's browser (no account needed):
 *  • the lines (design, quantity) in localStorage;
 *  • logo files in IndexedDB, because they can be several megabytes:
 *    the original file as uploaded (for printing) and the prepared preview.
 * Prices are never stored here: the server calculates them at checkout.
 */
import type { Configuration, LogoFormat } from "@/configurator/catalog";

export const MAX_LINES = 10;
export const MAX_QUANTITY = 10;

export type CartLogo = {
  mode: "full-color" | "one-color";
  color?: string;
  name: string;
  format: LogoFormat;
  width: number;
  height: number;
};

export type CartLine = {
  id: string;
  /** The design, without the logo image itself (see logo + IndexedDB). */
  configuration: Configuration;
  quantity: number;
  /** Link that reopens this design in the configurator. */
  designUrl: string;
  logo: CartLogo | null;
  addedAt: string;
};

export type StoredLogo = { original: Blob; originalName: string; preview: string };

const KEY = "twc-cart-v1";
const EVENT = "twc-cart-change";

/* ───────────── Lines (localStorage) ───────────── */

let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* Storage full or blocked: the cart still works until the page is closed. */
  }
  window.dispatchEvent(new Event(EVENT));
}

const EMPTY: CartLine[] = [];

export const cartStore = {
  subscribe(callback: () => void) {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        callback();
      }
    };
    window.addEventListener(EVENT, callback);
    window.addEventListener("storage", onStorage); // other tabs
    return () => {
      window.removeEventListener(EVENT, callback);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot: (): CartLine[] => read(),
  getServerSnapshot: (): CartLine[] => EMPTY,
};

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export type AddResult = { ok: true; id: string } | { ok: false; reason: "full" | "storage" };

export async function addToCart(
  line: Omit<CartLine, "id" | "addedAt" | "quantity">,
  logoFiles: StoredLogo | null,
): Promise<AddResult> {
  const lines = read();
  if (lines.length >= MAX_LINES) return { ok: false, reason: "full" };
  const id = crypto.randomUUID();
  if (logoFiles) {
    try {
      await putLogo(id, logoFiles);
    } catch {
      return { ok: false, reason: "storage" };
    }
  }
  write([...lines, { ...line, id, quantity: 1, addedAt: new Date().toISOString() }]);
  return { ok: true, id };
}

export function setQuantity(id: string, quantity: number) {
  const q = Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
  write(read().map((l) => (l.id === id ? { ...l, quantity: q } : l)));
}

export async function removeFromCart(id: string) {
  write(read().filter((l) => l.id !== id));
  await deleteLogo(id).catch(() => {});
}

export async function clearCart() {
  const ids = read().map((l) => l.id);
  write([]);
  await Promise.all(ids.map((id) => deleteLogo(id).catch(() => {})));
}

/* ───────────── Logo files (IndexedDB) ───────────── */

const DB = "twc-cart";
const STORE = "logos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const putLogo = (id: string, logo: StoredLogo) => tx("readwrite", (s) => s.put(logo, id)).then(() => undefined);
export const getLogo = (id: string) => tx<StoredLogo | undefined>("readonly", (s) => s.get(id));
export const deleteLogo = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => undefined);

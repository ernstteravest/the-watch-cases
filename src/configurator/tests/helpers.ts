import { options } from "../config/options";
import { getCatalog } from "../catalog";
import type { CatalogInput } from "../catalog/schema";

/** A deep, mutable copy of the shipped options for building invalid catalogs. */
export const cloneOptions = (): CatalogInput => structuredClone(options) as CatalogInput;

export const catalog = getCatalog();

/**
 * A data URL with a valid PNG header (signature + IHDR) of the given size; enough for validation.
 * `tag` adds bytes after the header, so different images of the same size get different URLs.
 */
export const pngDataUrl = (width: number, height: number, tag = 0): string => {
  const bytes = new Uint8Array(40);
  new DataView(bytes.buffer).setUint32(36, tag >>> 0);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
};

/** File bytes starting with a format's signature. */
export const fileBytes = {
  png: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x20, 0, 0, 1, 0x90]),
  jpeg: () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  gif: () => new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000"),
  webp: () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]),
  heic: () => new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]),
  pdf: () => new TextEncoder().encode("%PDF-1.7\n"),
  svg: (body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><rect width="300" height="120"/></svg>') => new TextEncoder().encode(body),
};

export const product = (id: string) => {
  const p = catalog.products.find((x) => x.id === id);
  if (!p) throw new Error(`no product ${id}`);
  return p;
};

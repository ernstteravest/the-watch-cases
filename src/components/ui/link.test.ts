import { describe, expect, it } from "vitest";
import { isAmbiguousDutchPath } from "./link";

describe("Link prefetch rule", () => {
  it("skips prefetching Dutch single-segment addresses only", () => {
    for (const p of ["/contact", "/cadeaus", "/winkelmand", "/ontwerp?model=duo"]) expect(isAmbiguousDutchPath(p)).toBe(true);
    for (const p of ["/", "/en", "/en/contact", "/collectie/duo", "/afrekenen/bedankt", "#duo", "mailto:a@b.nl"]) {
      expect(isAmbiguousDutchPath(p)).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { defaultConfiguration, getCatalog } from "@/configurator/catalog";
import { pngDataUrl } from "@/configurator/tests/helpers";
import { quoteOrder, type PriceList } from "./quote";

const catalog = getCatalog();
const prices: PriceList = { products: { duo: 34900, "quartet-slim": 39900 } };
const shipping = { country: "NL", costs: { NL: 0, BE: 0, DE: 1500 } };
const duo = (text = "") => {
  const c = defaultConfiguration(catalog, "duo");
  return { ...c, personalization: { ...c.personalization, text } };
};

describe("quoteOrder", () => {
  it("prices lines on the server and adds shipping", () => {
    const result = quoteOrder(
      catalog,
      prices,
      [{ configuration: duo(" A.V. "), quantity: 2 }, { configuration: defaultConfiguration(catalog, "quartet-slim"), quantity: 1 }],
      { ...shipping, country: "DE" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.lines[0]).toMatchObject({ unitPriceCents: 34900, lineTotalCents: 69800, engravingText: "A.V." });
    expect(result.quote.subtotalCents).toBe(109700);
    expect(result.quote.shippingCents).toBe(1500);
    expect(result.quote.totalCents).toBe(111200);
  });

  it("refuses to sell while a price is not set (€xxx.xx)", () => {
    const result = quoteOrder(catalog, { products: { duo: null } }, [{ configuration: duo(), quantity: 1 }], shipping);
    expect(result).toEqual({ ok: false, error: { code: "PRICE_NOT_SET", line: 0, product: "duo" } });
  });

  it("refuses countries we don't ship to and unset shipping costs", () => {
    expect(quoteOrder(catalog, prices, [{ configuration: duo(), quantity: 1 }], { ...shipping, country: "FR" })).toMatchObject({
      ok: false,
      error: { code: "SHIPPING_NOT_AVAILABLE" },
    });
    expect(
      quoteOrder(catalog, prices, [{ configuration: duo(), quantity: 1 }], { country: "BE", costs: { BE: null } }),
    ).toMatchObject({ ok: false, error: { code: "SHIPPING_PRICE_NOT_SET" } });
  });

  it("rejects bad quantities, designs and engravings", () => {
    expect(quoteOrder(catalog, prices, [{ configuration: duo(), quantity: 0 }], shipping)).toMatchObject({
      ok: false,
      error: { code: "INVALID_QUANTITY" },
    });
    expect(
      quoteOrder(catalog, prices, [{ configuration: { ...duo(), exterior: "purple" }, quantity: 1 }], shipping),
    ).toMatchObject({ ok: false, error: { code: "INVALID_DESIGN" } });
    expect(quoteOrder(catalog, prices, [{ configuration: duo("<script>"), quantity: 1 }], shipping)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ENGRAVING" },
    });
    expect(quoteOrder(catalog, prices, [], shipping)).toEqual({ ok: false, error: { code: "EMPTY_CART" } });
  });

  it("adds option surcharges when they are configured", () => {
    const result = quoteOrder(
      catalog,
      { ...prices, options: { "*": { "exterior:navy": 2500 } } },
      [{ configuration: duo(), quantity: 1 }],
      shipping,
    );
    expect(result.ok && result.quote.lines[0].unitPriceCents).toBe(37400);
  });

  it("needs the uploaded logo, keeps the image out of the order data and adds a logo surcharge", () => {
    const withLogo = (artwork: { name: string; format: "png"; dataUrl: string; width: number; height: number } | null) => ({
      ...duo(),
      logo: { mode: "full-color" as const, artwork },
    });
    expect(quoteOrder(catalog, prices, [{ configuration: withLogo(null), quantity: 1 }], shipping)).toEqual({
      ok: false,
      error: { code: "LOGO_MISSING", line: 0 },
    });

    const artwork = { name: "acme.png", format: "png" as const, dataUrl: pngDataUrl(800, 400), width: 800, height: 400 };
    const result = quoteOrder(
      catalog,
      { ...prices, options: { "*": { "logo:full-color": 1500 } } },
      [{ configuration: withLogo(artwork), quantity: 1 }],
      shipping,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.quote.lines[0];
    expect(line.unitPriceCents).toBe(36400);
    expect(line.logoArtwork).toEqual(artwork);
    expect(line.configuration.logo?.artwork?.dataUrl).toBe("");
    expect(line.configuration.logo?.artwork?.name).toBe("acme.png");
  });
});

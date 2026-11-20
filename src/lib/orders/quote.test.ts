import { describe, expect, it } from "vitest";
import { defaultConfiguration, getCatalog } from "@/configurator/catalog";
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

  it("needs the logo file, keeps the image out of the order data and adds a logo surcharge", () => {
    const withLogo = { ...duo(), logo: { mode: "full-color" as const, artwork: null } };
    expect(quoteOrder(catalog, prices, [{ configuration: withLogo, quantity: 1 }], shipping)).toEqual({
      ok: false,
      error: { code: "LOGO_MISSING", line: 0 },
    });

    const file = { name: "acme.png", format: "png" as const, width: 800, height: 400 };
    const result = quoteOrder(
      catalog,
      { ...prices, options: { "*": { "logo:full-color": 1500 } } },
      [{ configuration: withLogo, quantity: 1, logo: file }],
      shipping,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const line = result.quote.lines[0];
    expect(line.unitPriceCents).toBe(36400);
    expect(line.logo).toEqual(file);
    expect(line.configuration.logo?.artwork).toEqual({ ...file, dataUrl: "" });
  });

  it("ignores a logo file when no logo was chosen", () => {
    const file = { name: "acme.png", format: "png" as const, width: 800, height: 400 };
    const result = quoteOrder(catalog, prices, [{ configuration: duo(), quantity: 1, logo: file }], shipping);
    expect(result.ok && result.quote.lines[0].logo).toBeNull();
  });

  it("refuses a model that is switched off", () => {
    const quartet = defaultConfiguration(catalog, "quartet-slim");
    expect(
      quoteOrder(catalog, prices, [{ configuration: quartet, quantity: 1 }], shipping, (id) => id === "duo"),
    ).toEqual({ ok: false, error: { code: "PRODUCT_UNAVAILABLE", line: 0, product: "quartet-slim" } });
  });
});

import { describe, expect, it } from "vitest";
import { defaultConfiguration } from "../catalog";
import { decodeDesign, encodeDesign } from "../design-link";
import { catalog } from "./helpers";

describe("design link", () => {
  it("round-trips a customised design", () => {
    const configuration = {
      ...defaultConfiguration(catalog, "quartet-slim"),
      exterior: "black",
      interior: "red",
    };
    configuration.pieces = { ...configuration.pieces, strap: { material: "full-grain", color: "cognac" } };
    const params = encodeDesign(catalog, { configuration, name: " A.V. " });

    expect(params.get("model")).toBe("quartet-slim");
    expect(params.get("pieces")).toBe("strap.full-grain.cognac");
    expect(params.get("name")).toBe("A.V.");

    const decoded = decodeDesign(catalog, params);
    expect(decoded.configuration).toEqual(configuration);
    expect(decoded.name).toBe("A.V.");
  });

  it("keeps match tokens such as match:interior", () => {
    const configuration = defaultConfiguration(catalog, "duo");
    configuration.pieces = { ...configuration.pieces, cushions: { material: "nappa", color: "match:exterior" } };
    const decoded = decodeDesign(catalog, encodeDesign(catalog, { configuration, name: "" }));
    expect(decoded.configuration.pieces.cushions).toEqual({ material: "nappa", color: "match:exterior" });
  });

  it("only selects the model when coming from a product page", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=quartet-slim"));
    expect(decoded.configuration).toEqual(defaultConfiguration(catalog, "quartet-slim"));
  });

  it("falls back to defaults for unknown models, colours and pieces", () => {
    const decoded = decodeDesign(
      catalog,
      new URLSearchParams("model=octo&ext=purple&int=beige&pieces=strap.suede.gold,unknown.x.y"),
    );
    const base = defaultConfiguration(catalog, catalog.defaultProduct);
    expect(decoded.configuration.product).toBe(catalog.defaultProduct);
    expect(decoded.configuration.exterior).toBe(base.exterior);
    expect(decoded.configuration.interior).toBe("beige");
    expect(decoded.configuration.pieces).toEqual(base.pieces);
  });
});

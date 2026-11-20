import { describe, expect, it } from "vitest";
import { defaultConfiguration } from "../catalog";
import { decodeDesign, encodeDesign } from "../design-link";
import { catalog } from "./helpers";

describe("design link", () => {
  it("round-trips a design", () => {
    const configuration = { ...defaultConfiguration(catalog, "quartet-slim"), exterior: "black", interior: "red" };
    const params = encodeDesign(catalog, { configuration, name: " A.V. " });

    expect(params.toString()).toBe("model=quartet-slim&ext=black&int=red&name=A.V.");
    const decoded = decodeDesign(catalog, params);
    expect(decoded.configuration).toEqual(configuration);
    expect(decoded.name).toBe("A.V.");
  });

  it("only selects the model when coming from a product page", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=quartet-slim"));
    expect(decoded.configuration).toEqual(defaultConfiguration(catalog, "quartet-slim"));
  });

  it("opens old links that still list leather pieces", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=duo&ext=cognac&int=beige&pieces=strap.full-grain.cognac"));
    expect(decoded.configuration).toEqual({ ...defaultConfiguration(catalog, "duo"), exterior: "cognac", interior: "beige" });
  });

  it("falls back to defaults for unknown models and colours", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=octo&ext=purple&int=beige"));
    const base = defaultConfiguration(catalog, catalog.defaultProduct);
    expect(decoded.configuration.product).toBe(catalog.defaultProduct);
    expect(decoded.configuration.exterior).toBe(base.exterior);
    expect(decoded.configuration.interior).toBe("beige");
  });

  it("maps the old brand colour ids to the default", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=duo&ext=rolex-green"));
    expect(decoded.configuration.exterior).toBe(defaultConfiguration(catalog, "duo").exterior);
  });

  it("opens a switched-off model's link with a model that is on offer", () => {
    const decoded = decodeDesign(catalog, new URLSearchParams("model=quartet-slim&ext=black&int=red"), (id) => id === "duo");
    expect(decoded.configuration.product).toBe("duo");
    expect(decoded.configuration.exterior).toBe("black");
    expect(decoded.configuration.interior).toBe("red");
  });
});

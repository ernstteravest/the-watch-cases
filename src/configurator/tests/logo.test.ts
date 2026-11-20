/**
 * Logo rules (pure): format recognition, upload checks, SVG sizing, the logo
 * in a configuration, the summary line, placement on the lid and the
 * single-colour print mask.
 */
import { describe, expect, it } from "vitest";
import {
  defaultConfiguration,
  defaultRenderProps,
  describeLogo,
  detectFileFormat,
  isValidArtwork,
  loadCatalog,
  normalisedLogoSize,
  svgIntrinsicSize,
  validateConfiguration,
  validateLogo,
  validateLogoDimensions,
  validateLogoFile,
  validateRenderProps,
  type LogoArtwork,
  type LogoChoice,
} from "../catalog";
import { fitLogo } from "../geometry/layout";
import { describeScene, logoAnchorFor } from "../scene/describeScene";
import { catalog, cloneOptions, fileBytes, pngDataUrl } from "./helpers";

const rules = catalog.logo;
const artwork = (overrides: Partial<LogoArtwork> = {}): LogoArtwork => ({
  name: "acme.png",
  format: "png",
  dataUrl: pngDataUrl(800, 400),
  width: 800,
  height: 400,
  ...overrides,
});
const codes = (r: { ok: boolean; issues?: Array<{ code: string }> }) => (r.ok ? [] : (r.issues ?? []).map((i) => i.code));

describe("logo catalog", () => {
  it("ships full colour and one colour, with the four colours labelled exactly zilver, wit, zwart, goud", () => {
    expect(rules.modes.map((m) => m.id)).toEqual(["full-color", "one-color"]);
    expect(rules.colors.map((c) => c.label)).toEqual(["zilver", "wit", "zwart", "goud"]);
  });

  it("rejects a logo area that doesn't fit the lid, an unknown default colour and an unknown logo view", () => {
    const raw = cloneOptions();
    raw.products[0].logo.widthCm = 20; // the Duo lid is 16 cm long
    raw.logo.defaultColor = "brons";
    raw.presentation.logoView = "drone";
    const result = loadCatalog(raw);
    const issueCodes = result.ok ? [] : result.issues.map((i) => i.code);
    expect(issueCodes).toEqual(expect.arrayContaining(["logo_area_too_large", "default_not_in_palette", "unknown_view"]));
  });

  it("rejects duplicate logo colours", () => {
    const raw = cloneOptions();
    raw.logo.colors.push({ ...raw.logo.colors[0] });
    const result = loadCatalog(raw);
    expect(result.ok ? [] : result.issues.map((i) => i.code)).toContain("duplicate_id");
  });
});

describe("format recognition (by content)", () => {
  it("recognises PNG, JPG and SVG, including SVGs with an XML declaration, comment, doctype or BOM", () => {
    expect(detectFileFormat(fileBytes.png())).toBe("png");
    expect(detectFileFormat(fileBytes.jpeg())).toBe("jpeg");
    expect(detectFileFormat(fileBytes.svg())).toBe("svg");
    expect(
      detectFileFormat(
        fileBytes.svg(
          '﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg width="10" height="10"/>',
        ),
      ),
    ).toBe("svg");
  });

  it("names other formats, and returns null for anything else", () => {
    expect(detectFileFormat(fileBytes.gif())).toBe("gif");
    expect(detectFileFormat(fileBytes.webp())).toBe("webp");
    expect(detectFileFormat(fileBytes.heic())).toBe("heic");
    expect(detectFileFormat(fileBytes.pdf())).toBe("pdf");
    expect(detectFileFormat(new TextEncoder().encode("<html><body>logo</body></html>"))).toBeNull();
    expect(detectFileFormat(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("upload checks", () => {
  const file = (name: string, header: Uint8Array, size = 50_000) => ({ name, header, size });

  it("accepts PNG, JPG and SVG, judged by content even if the extension is wrong", () => {
    expect(validateLogoFile(file("a.png", fileBytes.png()), rules)).toEqual({ ok: true, value: "png" });
    expect(validateLogoFile(file("a.jpeg", fileBytes.jpeg()), rules)).toEqual({ ok: true, value: "jpeg" });
    expect(validateLogoFile(file("a.svg", fileBytes.svg()), rules)).toEqual({ ok: true, value: "svg" });
    expect(validateLogoFile(file("photo.png", fileBytes.jpeg()), rules)).toEqual({ ok: true, value: "jpeg" });
  });

  it("rejects unsupported formats with a message that names them", () => {
    const gif = validateLogoFile(file("anim.gif", fileBytes.gif()), rules);
    expect(codes(gif)).toEqual(["logo_unsupported_format"]);
    if (!gif.ok) expect(gif.issues[0].message).toBe("“anim.gif” is a GIF image. Upload your logo as a PNG, JPG or SVG file.");
    const renamed = validateLogoFile(file("logo.png", fileBytes.webp()), rules);
    if (!renamed.ok) expect(renamed.issues[0].message).toContain("is a WebP image");
    const text = validateLogoFile(file("notes.txt", new TextEncoder().encode("hello")), rules);
    if (!text.ok) expect(text.issues[0].message).toBe("“notes.txt” isn't a PNG, JPG or SVG file. Upload your logo in one of those formats.");
  });

  it("rejects formats the catalog doesn't offer", () => {
    const pngOnly = { ...rules, upload: { ...rules.upload, formats: ["png" as const] } };
    const r = validateLogoFile(file("a.svg", fileBytes.svg()), pngOnly);
    expect(codes(r)).toEqual(["logo_unsupported_format"]);
    if (!r.ok) expect(r.issues[0].message).toContain("Upload your logo as a PNG file");
  });

  it("rejects empty and too large files", () => {
    expect(codes(validateLogoFile(file("a.png", new Uint8Array(), 0), rules))).toEqual(["logo_empty"]);
    const big = validateLogoFile(file("big.png", fileBytes.png(), 12.4 * 1024 * 1024), rules);
    expect(codes(big)).toEqual(["logo_file_too_large"]);
    if (!big.ok) expect(big.issues[0].message).toBe("“big.png” is 12.4 MB. Use a file of at most 10 MB.");
  });

  it("rejects PNG/JPG logos that are too small to print, but not SVGs", () => {
    const small = validateLogoDimensions({ width: 240, height: 120 }, "png", rules, "tiny.png");
    expect(small.map((i) => i.code)).toEqual(["logo_too_small"]);
    expect(small[0].message).toContain("240 × 120 pixels");
    expect(validateLogoDimensions({ width: 500, height: 80 }, "jpeg", rules, "wide.jpg")).toEqual([]);
    expect(validateLogoDimensions({ width: 120, height: 40 }, "svg", rules, "mark.svg")).toEqual([]);
    expect(validateLogoDimensions({ width: 0, height: 0 }, "svg", rules, "mark.svg").map((i) => i.code)).toEqual(["logo_no_size"]);
  });
});

describe("SVG size and normalised size", () => {
  it("reads width/height with units, or the viewBox", () => {
    expect(svgIntrinsicSize('<svg width="300" height="120">')).toEqual({ width: 300, height: 120 });
    expect(svgIntrinsicSize('<svg width="25.4mm" height="1in">')).toEqual({ width: 96, height: 96 });
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">')).toEqual({ width: 400, height: 100 });
    expect(svgIntrinsicSize('<svg width="200" viewBox="0,0,400,100" stroke-width="3">')).toEqual({ width: 200, height: 50 });
    expect(svgIntrinsicSize('<svg width="100%" height="100%">')).toBeNull();
    expect(svgIntrinsicSize("<svg>")).toBeNull();
  });

  it("scales down large rasters, never up, and draws vectors at the full size", () => {
    expect(normalisedLogoSize({ width: 4000, height: 1000 }, "png", 1024)).toEqual({ width: 1024, height: 256 });
    expect(normalisedLogoSize({ width: 600, height: 300 }, "jpeg", 1024)).toEqual({ width: 600, height: 300 });
    expect(normalisedLogoSize({ width: 300, height: 120 }, "svg", 1024)).toEqual({ width: 1024, height: 410 });
  });
});

describe("the logo in a configuration", () => {
  it("is optional: no logo means no logo key", () => {
    expect(validateLogo(undefined, rules)).toEqual({ ok: true, value: undefined });
    const r = validateConfiguration(catalog, defaultConfiguration(catalog));
    expect(r.ok && r.value.configuration).not.toHaveProperty("logo");
  });

  it("returns the canonical form for each mode", () => {
    expect(validateLogo({ mode: "full-color", color: "goud", artwork: artwork() }, rules)).toEqual({
      ok: true,
      value: { mode: "full-color", artwork: artwork() },
    });
    expect(validateLogo({ mode: "one-color", color: "goud", artwork: artwork() }, rules)).toEqual({
      ok: true,
      value: { mode: "one-color", color: "goud", artwork: artwork() },
    });
  });

  it("needs one of the four colours in one-colour mode", () => {
    expect(codes(validateLogo({ mode: "one-color", artwork: artwork() }, rules))).toEqual(["logo_color_required"]);
    expect(codes(validateLogo({ mode: "one-color", color: "brons", artwork: artwork() }, rules))).toEqual(["logo_color_not_offered"]);
    for (const color of ["zilver", "wit", "zwart", "goud"]) expect(validateLogo({ mode: "one-color", color, artwork: artwork() }, rules).ok).toBe(true);
  });

  it("allows a chosen logo without upload in the preview, but not for the final render", () => {
    const pending: LogoChoice = { mode: "full-color", artwork: null };
    expect(validateLogo(pending, rules).ok).toBe(true);
    expect(codes(validateLogo(pending, rules, "logo", { requireArtwork: true }))).toEqual(["logo_missing"]);
    const props = { ...defaultRenderProps(catalog), configuration: { ...defaultConfiguration(catalog), logo: pending } };
    expect(validateRenderProps(catalog, props).ok).toBe(true);
    expect(codes(validateRenderProps(catalog, props, { final: true }))).toEqual(["logo_missing"]);
  });

  it("rejects artwork that isn't a PNG of the declared size", () => {
    expect(isValidArtwork(artwork())).toBe(true);
    expect(isValidArtwork(artwork({ width: 801 }))).toBe(false);
    expect(isValidArtwork(artwork({ dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD" }))).toBe(false);
    expect(isValidArtwork(artwork({ dataUrl: "data:image/png;base64,not base64!" }))).toBe(false);
    expect(codes(validateLogo({ mode: "full-color", artwork: artwork({ height: 1 }) }, rules))).toEqual(["logo_invalid_artwork"]);
  });

  it("is rejected when logos are disabled", () => {
    expect(codes(validateLogo({ mode: "full-color", artwork: artwork() }, { ...rules, enabled: false }))).toContain("logo_disabled");
  });
});

describe("summary line", () => {
  it("shows the mode, the colour and the file name where relevant", () => {
    expect(describeLogo(catalog, undefined)).toBeNull();
    expect(describeLogo(catalog, { mode: "full-color", artwork: artwork() })).toBe("Logo: full colour, acme.png.");
    expect(describeLogo(catalog, { mode: "one-color", color: "goud", artwork: artwork({ name: "acme.svg", format: "svg" }) })).toBe(
      "Logo: one colour, goud, acme.svg.",
    );
    expect(describeLogo(catalog, { mode: "one-color", color: "zwart", artwork: null })).toBe("Logo: one colour, zwart, not uploaded yet.");
  });
});

describe("placement and print", () => {
  it("sits in the middle of the outside of the lid, within the product's logo area", () => {
    for (const p of catalog.products) {
      const anchor = logoAnchorFor(catalog, p.id);
      expect(anchor.placement).toBe("lid-top");
      expect(anchor.assembly).toBe("lid");
      expect(anchor.center[0]).toBe(0);
      expect(anchor.center[2]).toBe(0);
      expect(anchor.normal).toEqual([0, 1, 0]);
      expect([anchor.widthCm, anchor.heightCm]).toEqual([p.logo.widthCm, p.logo.heightCm]);
    }
  });

  it("fits the artwork inside the area, keeping its aspect ratio", () => {
    expect(fitLogo({ widthCm: 7, heightCm: 4 }, 2)).toEqual({ widthCm: 7, heightCm: 3.5 });
    expect(fitLogo({ widthCm: 7, heightCm: 4 }, 1)).toEqual({ widthCm: 4, heightCm: 4 });
    expect(fitLogo({ widthCm: 7, heightCm: 4 }, Number.NaN)).toEqual({ widthCm: 7, heightCm: 4 });
  });

  it("describes the print for the scene: as is in full colour, in ink or foil in one colour", () => {
    const scene = (logo: LogoChoice) => {
      const valid = validateRenderProps(catalog, { ...defaultRenderProps(catalog), configuration: { ...defaultConfiguration(catalog), logo } });
      if (!valid.ok) throw new Error(valid.issues.map((i) => i.message).join(" "));
      return describeScene(catalog, valid.value).logo;
    };
    const full = scene({ mode: "full-color", artwork: artwork() });
    expect(full).toMatchObject({ mode: "full-color", ink: null, printRoughness: 0.42, widthCm: 7, heightCm: 3.5 });
    const goud = scene({ mode: "one-color", color: "goud", artwork: artwork() });
    expect(goud?.ink).toEqual({ hex: "#d2ab5f", finish: "metallic", roughness: 0.3 });
    const pending = scene({ mode: "one-color", color: "wit", artwork: null });
    expect(pending?.artwork).toBeNull();
    expect([pending?.widthCm, pending?.heightCm]).toEqual([7, 4]);
  });
});

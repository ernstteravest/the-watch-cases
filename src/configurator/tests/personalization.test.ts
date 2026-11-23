import { describe, expect, it } from "vitest";
import { effectiveMaxLength, normalizePersonalization, validatePersonalization } from "../catalog";
import { catalog, product } from "./helpers";

const rules = catalog.personalization;
const duo = product("duo");
const quartet = product("quartet-slim");

describe("personalization rules", () => {
  it("is optional: empty and whitespace-only text are valid and empty", () => {
    expect(validatePersonalization("", rules, duo)).toEqual({ ok: true, value: "" });
    expect(validatePersonalization("   ", rules, duo)).toEqual({ ok: true, value: "" });
  });

  it("trims and collapses whitespace", () => {
    expect(normalizePersonalization("  Anna   &  Ben ", rules)).toBe("Anna & Ben");
    expect(validatePersonalization("  A.  V. ", rules, duo)).toEqual({ ok: true, value: "A. V." });
  });

  it("uses the per-product maximum length (Duo 15, Quartet Slim 18)", () => {
    expect(effectiveMaxLength(rules, duo)).toBe(15);
    expect(effectiveMaxLength(rules, quartet)).toBe(18);
    expect(validatePersonalization("ABCDEFGHIJKLMNO", rules, duo).ok).toBe(true);
    const tooLong = validatePersonalization("ABCDEFGHIJKLMNOP", rules, duo);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.issues[0].code).toBe("too_long");
    expect(validatePersonalization("ABCDEFGHIJKLMNOP", rules, quartet).ok).toBe(true);
  });

  it("allows accented Latin letters, digits and . & ' -", () => {
    for (const ok of ["Zoë", "Åsa", "Łukasz", "Jean-Luc", "O'Neil", "A & B", "1987", "J.R.R."]) {
      expect(validatePersonalization(ok, rules, quartet).ok, ok).toBe(true);
    }
  });

  it("rejects other characters and names them in the message", () => {
    const r = validatePersonalization("Hi 🙂 @home", rules, quartet);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].code).toBe("invalid_characters");
    expect(r.issues[0].message).toContain("🙂");
    expect(r.issues[0].message).toContain("@");
    for (const bad of ["<b>", "名前", "a/b", "x_y"]) expect(validatePersonalization(bad, rules, quartet).ok, bad).toBe(false);
  });

  it("counts characters, not UTF-16 code units", () => {
    expect(validatePersonalization("ÉÉÉÉÉÉÉÉÉÉÉÉ", rules, duo).ok).toBe(true);
  });

  it("applies the uppercase rule when configured", () => {
    expect(normalizePersonalization("av", { ...rules, uppercase: true })).toBe("AV");
  });

  it("respects the enabled switch", () => {
    const r = validatePersonalization("AV", { ...rules, enabled: false }, duo);
    expect(r.ok).toBe(false);
  });
});

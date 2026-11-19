import { describe, expect, it } from "vitest";
import { validateLogoDimensions, validateLogoFile } from "../catalog";
import { createLabels } from "../labels";
import { catalog } from "./helpers";

const nl = createLabels(catalog, "nl");
const en = createLabels(catalog, "en");
const issue = (r: { ok: boolean; issues?: { path: string; code: string; message: string }[] }) => {
  if (r.ok || !r.issues) throw new Error("expected a problem");
  return r.issues[0];
};

describe("labels", () => {
  it("translates logo upload problems into Dutch, keeping file names and numbers", () => {
    const big = issue(
      validateLogoFile({ name: "logo2024.png", size: 12 * 1024 * 1024, header: new Uint8Array() }, catalog.logo),
    );
    expect(nl.logoIssue(big)).toBe("“logo2024.png” is 12 MB. Gebruik een bestand van maximaal 10 MB.");
    expect(en.logoIssue(big)).toBe(big.message);

    const small = validateLogoDimensions({ width: 300, height: 120 }, "png", catalog.logo, "acme.png")[0];
    expect(nl.logoIssue(small)).toContain("300 × 120 pixels");
    expect(nl.logoIssue(small)).toContain("minstens 500 pixels");
    expect(nl.logoIssue(small)).toContain("“acme.png”");

    const empty = issue(validateLogoFile({ name: "leeg.png", size: 0, header: new Uint8Array() }, catalog.logo));
    expect(nl.logoIssue(empty)).toBe("“leeg.png” is leeg. Kies uw logobestand opnieuw.");
  });

  it("names logo colours in each language and lists what follows the interior", () => {
    expect(nl.logoColor("goud")).toBe("goud");
    expect(en.logoColor("goud")).toBe("gold");
    expect(nl.interiorFollowers()).toMatch(/lipje en drukknoop/);
    expect(en.interiorFollowers()).toMatch(/lid strap and snap cap/);
  });

  it("uses the Money green and Signal orange names", () => {
    expect(nl.color("money-green")).toBe("Money green");
    expect(en.color("signal-orange")).toBe("Signal orange");
  });
});

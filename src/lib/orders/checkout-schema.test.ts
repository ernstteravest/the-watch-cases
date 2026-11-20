import { describe, expect, it } from "vitest";
import { checkoutSchema, fieldErrors } from "./checkout-schema";

const valid = {
  locale: "nl",
  email: " Anna@Example.com ",
  firstName: "Anna",
  lastName: "de Vries",
  phone: "",
  shipping: { name: "Anna de Vries", line1: "Damrak 1", postalCode: "1012 LG", city: "Amsterdam", country: "NL" },
  billingSameAsShipping: true,
  company: "",
  vatNumber: "",
  acceptTerms: true,
} as const;

describe("checkout form", () => {
  it("accepts a valid Dutch order and normalises e-mail and empty fields", () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.email).toBe("anna@example.com");
    expect(r.data.phone).toBeUndefined();
    expect(r.data.company).toBeUndefined();
  });

  it("checks postcodes per country", () => {
    const at = (country: string, postalCode: string) =>
      checkoutSchema.safeParse({ ...valid, shipping: { ...valid.shipping, country, postalCode } }).success;
    expect(at("NL", "1012LG")).toBe(true);
    expect(at("BE", "1000")).toBe(true);
    expect(at("DE", "10115")).toBe(true);
    expect(at("NL", "1000")).toBe(false);
    expect(at("DE", "1012 LG")).toBe(false);
    expect(at("FR", "75001")).toBe(false);
  });

  it("requires the terms and a billing address when it differs", () => {
    const r = checkoutSchema.safeParse({ ...valid, acceptTerms: false, billingSameAsShipping: false });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errors = fieldErrors(r.error);
    expect(errors.acceptTerms).toBe("terms");
    expect(errors["billing.line1"]).toBe("required");
  });

  it("normalises and checks VAT numbers", () => {
    const ok = checkoutSchema.safeParse({ ...valid, company: "Acme BV", vatNumber: "nl 8543.21.098.B01" });
    expect(ok.success && ok.data.vatNumber).toBe("NL854321098B01");
    const bad = checkoutSchema.safeParse({ ...valid, vatNumber: "123" });
    expect(bad.success).toBe(false);
  });
});

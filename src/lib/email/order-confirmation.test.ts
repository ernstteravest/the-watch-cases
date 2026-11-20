import { describe, expect, it } from "vitest";
import { orderConfirmationEmail } from "./order-confirmation";

const base = {
  to: "klant@example.com",
  firstName: "Anna",
  orderNumber: "TWC-2026-0001",
  lines: [{ description: "Duo in navy leer met beige suède, met de gravering “A.V.”", quantity: 1, lineTotalCents: 34900 }],
  shippingCents: 0,
  totalCents: 34900,
  requiresLogoReview: false,
};

describe("order confirmation e-mail", () => {
  it("writes Dutch with the order number, lines, free shipping and total", () => {
    const mail = orderConfirmationEmail({ ...base, locale: "nl" });
    expect(mail.subject).toBe("Uw bestelling TWC-2026-0001 bij The Watch Cases");
    expect(mail.text).toContain("Beste Anna,");
    expect(mail.text).toContain("14 werkdagen");
    expect(mail.text).toContain("Verzending: gratis");
    expect(mail.text).toMatch(/Totaal \(incl\. btw\): €\s?349/);
    expect(mail.text).not.toContain("logo");
  });

  it("mentions the logo check and escapes customer text in HTML", () => {
    const mail = orderConfirmationEmail({
      ...base,
      locale: "en",
      firstName: "<b>Bob</b>",
      requiresLogoReview: true,
    });
    expect(mail.text).toContain("We check the logo first");
    expect(mail.html).toContain("&lt;b&gt;Bob&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Bob</b>");
  });
});

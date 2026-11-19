import type { Catalog, Issue, PersonalizationRules, Product, Result } from "./schema";

/**
 * Effective maximum length for a product: the product override if present,
 * otherwise the global rule.
 */
export const effectiveMaxLength = (rules: PersonalizationRules, product?: Product): number =>
  product?.engraving.maxLength ?? rules.maxLength;

/** Applies the catalog's normalisation (trim, collapse spaces, uppercase). Does not validate. */
export const normalizePersonalization = (text: string, rules: PersonalizationRules): string => {
  let value = text.normalize("NFC");
  if (rules.collapseWhitespace) value = value.replace(/\s+/g, " ");
  if (rules.trim) value = value.trim();
  if (rules.uppercase) value = value.toLocaleUpperCase();
  return value;
};

const characters = (text: string) => Array.from(text);

/**
 * Validates personalization text. Empty text is valid (personalization is optional).
 * Returns the normalised value that the preview and the render should use.
 */
export const validatePersonalization = (
  text: string,
  rules: PersonalizationRules,
  product?: Product,
  path = "personalization.text",
): Result<string> => {
  const value = normalizePersonalization(text, rules);
  if (value.length === 0) return { ok: true, value };

  const issues: Issue[] = [];
  if (!rules.enabled) {
    issues.push({ path, code: "personalization_disabled", message: "Personalization is not available." });
    return { ok: false, issues };
  }
  const max = effectiveMaxLength(rules, product);
  const length = characters(value).length;
  if (length < rules.minLength) {
    issues.push({ path, code: "too_short", message: `Use at least ${rules.minLength} characters.` });
  }
  if (length > max) {
    issues.push({ path, code: "too_long", message: `Use at most ${max} characters (currently ${length}).` });
  }
  const pattern = new RegExp(rules.allowedPattern, "u");
  if (!pattern.test(value)) {
    const invalid = [...new Set(characters(value).filter((ch) => !pattern.test(ch)))];
    issues.push({
      path,
      code: "invalid_characters",
      message: `Not allowed: ${invalid.map((c) => (c === " " ? "space" : `“${c}”`)).join(" ")}. ${rules.allowedDescription}.`,
    });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
};

export const personalizationRulesSummary = (catalog: Catalog, product?: Product): string =>
  `Up to ${effectiveMaxLength(catalog.personalization, product)} characters. ${catalog.personalization.allowedDescription}.`;

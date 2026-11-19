/**
 * Load-time validation of the options catalog: structural (zod) checks first,
 * then cross-reference and geometry checks. Never throws for bad input —
 * returns a Result with every issue found, so editors see all problems at once.
 */
import type { ZodError } from "zod";
import {
  computeBoxLayout,
  DimensionError,
  ENGRAVING_PLACEMENTS,
  isEngravingPlacement,
  logoAnchor,
  validateConstruction,
  validateDimensions,
  withEngravingArea,
} from "../geometry/layout";
import { catalogSchema, MATCH_PREFIX, type Catalog, type Issue, type Result } from "./schema";

export const zodIssues = (error: ZodError, prefix = ""): Issue[] =>
  error.issues.map((i) => ({
    path: [prefix, ...i.path.map(String)].filter(Boolean).join("."),
    code: i.code,
    message: i.message,
  }));

export class CatalogValidationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`The options catalog (config/options.ts) is invalid:\n${issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")}`);
    this.name = "CatalogValidationError";
  }
}

const findDuplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

export const loadCatalog = (raw: unknown): Result<Catalog> => {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: zodIssues(parsed.error) };
  }
  const catalog = parsed.data;
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });

  const colorIds = new Set(catalog.colors.map((c) => c.id));
  const materialIds = new Set(catalog.materials.map((m) => m.id));
  const pieceIds = new Set(catalog.pieces.map((p) => p.id));

  for (const [list, name] of [
    [catalog.colors.map((c) => c.id), "colors"],
    [catalog.materials.map((m) => m.id), "materials"],
    [catalog.products.map((p) => p.id), "products"],
    [catalog.pieces.map((p) => p.id), "pieces"],
    [catalog.presentation.views.map((v) => v.id), "presentation.views"],
    [catalog.logo.modes.map((m) => m.id), "logo.modes"],
    [catalog.logo.colors.map((c) => c.id), "logo.colors"],
  ] as const) {
    for (const dup of new Set(findDuplicates([...list]))) {
      add(name, "duplicate_id", `Duplicate id "${dup}" in ${name}.`);
    }
  }
  for (const reserved of ["exterior", "interior"]) {
    if (pieceIds.has(reserved)) add("pieces", "reserved_id", `"${reserved}" is reserved and cannot be a piece id.`);
  }

  // Colour tones must reference real materials.
  catalog.colors.forEach((color, i) => {
    for (const materialId of Object.keys(color.tones ?? {})) {
      if (!materialIds.has(materialId)) {
        add(`colors.${i}.tones.${materialId}`, "unknown_material", `Tone for unknown material "${materialId}".`);
      }
    }
  });

  // Products
  if (!catalog.products.some((p) => p.id === catalog.defaultProduct)) {
    add("defaultProduct", "unknown_product", `defaultProduct "${catalog.defaultProduct}" is not a product.`);
  }
  catalog.products.forEach((product, i) => {
    const dimIssues = [
      ...validateDimensions(product.dimensions, `products.${i}.dimensions`),
      ...validateConstruction(product.dimensions, catalog.construction, "construction"),
    ];
    issues.push(...dimIssues);
    if (dimIssues.length === 0) {
      const layout = computeBoxLayout(product.dimensions, catalog.construction);
      const check = (path: string, fn: () => unknown) => {
        try {
          fn();
        } catch (e) {
          if (!(e instanceof DimensionError)) throw e;
          e.issues.forEach((issue) => add(path, issue.code, issue.message));
        }
      };
      check(`products.${i}.engraving`, () =>
        withEngravingArea(
          layout,
          { widthCm: product.engraving.widthCm, heightCm: product.engraving.heightCm },
          catalog.personalization.placements.map((p) => p.id),
        ),
      );
      check(`products.${i}.logo`, () => logoAnchor(layout, product.logo));
    }
    if (product.engraving.maxLength !== undefined && product.engraving.maxLength < catalog.personalization.minLength) {
      add(`products.${i}.engraving.maxLength`, "invalid_length", "Product maxLength is smaller than personalization.minLength.");
    }
  });

  // Surfaces
  for (const key of ["exterior", "interior"] as const) {
    const surface = catalog[key];
    if (!materialIds.has(surface.material)) add(`${key}.material`, "unknown_material", `Unknown material "${surface.material}".`);
    surface.colors.forEach((c, i) => {
      if (!colorIds.has(c)) add(`${key}.colors.${i}`, "unknown_color", `Unknown colour "${c}".`);
    });
    if (!surface.colors.includes(surface.default)) {
      add(`${key}.default`, "default_not_in_palette", `Default "${surface.default}" is not in the ${key} palette.`);
    }
  }

  // Pieces, including "match:" references
  const paletteOf = (target: string): string[] | null => {
    if (target === "exterior" || target === "interior") return catalog[target].colors;
    return catalog.pieces.find((p) => p.id === target)?.colors ?? null;
  };
  catalog.pieces.forEach((piece, i) => {
    piece.materials.forEach((m, j) => {
      if (!materialIds.has(m)) add(`pieces.${i}.materials.${j}`, "unknown_material", `Unknown material "${m}".`);
    });
    piece.colors.forEach((c, j) => {
      if (!colorIds.has(c)) add(`pieces.${i}.colors.${j}`, "unknown_color", `Unknown colour "${c}".`);
    });
    if (!piece.materials.includes(piece.default.material)) {
      add(`pieces.${i}.default.material`, "default_not_allowed", `Default material "${piece.default.material}" is not offered for "${piece.id}".`);
    }
    const color = piece.default.color;
    if (color.startsWith(MATCH_PREFIX)) {
      const target = color.slice(MATCH_PREFIX.length);
      const palette = paletteOf(target);
      if (!palette) {
        add(`pieces.${i}.default.color`, "unknown_match_target", `"${color}" refers to unknown "${target}".`);
      } else if (target === piece.id) {
        add(`pieces.${i}.default.color`, "match_cycle", `"${piece.id}" cannot match itself.`);
      } else {
        const missing = palette.filter((c) => !piece.colors.includes(c));
        if (missing.length > 0 && (target === "exterior" || target === "interior")) {
          add(
            `pieces.${i}.colors`,
            "match_palette_incomplete",
            `"${piece.id}" matches ${target} by default but does not offer: ${missing.join(", ")}.`,
          );
        }
      }
    } else if (!piece.colors.includes(color)) {
      add(`pieces.${i}.default.color`, "default_not_in_palette", `Default colour "${color}" is not offered for "${piece.id}".`);
    }
  });

  // Match cycles between pieces (a → b → a)
  for (const piece of catalog.pieces) {
    const seen = new Set<string>([piece.id]);
    let current = piece.default.color;
    while (current.startsWith(MATCH_PREFIX)) {
      const target = current.slice(MATCH_PREFIX.length);
      if (target === "exterior" || target === "interior") break;
      if (seen.has(target)) {
        add(`pieces.${piece.id}.default.color`, "match_cycle", `Circular colour match: ${[...seen, target].join(" → ")}.`);
        break;
      }
      seen.add(target);
      const next = catalog.pieces.find((p) => p.id === target);
      if (!next) break;
      current = next.default.color;
    }
  }

  // Personalization
  const rules = catalog.personalization;
  try {
    new RegExp(rules.allowedPattern, "u");
  } catch (e) {
    add("personalization.allowedPattern", "invalid_regex", `Not a valid regular expression: ${(e as Error).message}`);
  }
  if (rules.minLength > rules.maxLength) {
    add("personalization.minLength", "invalid_length", "minLength must not exceed maxLength.");
  }
  rules.placements.forEach((p, i) => {
    if (!isEngravingPlacement(p.id)) {
      add(`personalization.placements.${i}.id`, "unknown_placement", `"${p.id}" is not an engraving surface (${ENGRAVING_PLACEMENTS.join(", ")}).`);
    }
  });
  if (!rules.placements.some((p) => p.id === rules.defaultPlacement)) {
    add("personalization.defaultPlacement", "unknown_placement", `Unknown placement "${rules.defaultPlacement}".`);
  }

  // Logo
  if (!catalog.logo.colors.some((c) => c.id === catalog.logo.defaultColor)) {
    add("logo.defaultColor", "default_not_in_palette", `Default "${catalog.logo.defaultColor}" is not one of the logo colours.`);
  }

  // Presentation
  const viewIds = new Set(catalog.presentation.views.map((v) => v.id));
  for (const key of ["defaultView", "personalizationView", "logoView"] as const) {
    if (!viewIds.has(catalog.presentation[key])) {
      add(`presentation.${key}`, "unknown_view", `Unknown view "${catalog.presentation[key]}".`);
    }
  }
  const cam = catalog.presentation.camera;
  if (cam.minElevation >= cam.maxElevation) {
    add("presentation.camera.minElevation", "invalid_range", "minElevation must be below maxElevation.");
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: catalog };
};

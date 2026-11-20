/**
 * Customer configuration: defaults, validation against the catalog, and
 * resolution of "match:" colour tokens into concrete materials.
 */
import { validateLogo } from "./logo";
import { validatePersonalization } from "./personalization";
import {
  configurationSchema,
  MATCH_PREFIX,
  renderPropsSchema,
  type Catalog,
  type ColorOption,
  type Configuration,
  type Issue,
  type MaterialOption,
  type PieceChoice,
  type Product,
  type RenderProps,
  type Result,
  type ViewState,
} from "./schema";
import { zodIssues } from "./loadCatalog";

export const findProduct = (catalog: Catalog, id: string): Product | undefined => catalog.products.find((p) => p.id === id);

export const defaultConfiguration = (catalog: Catalog, productId = catalog.defaultProduct): Configuration => ({
  product: productId,
  exterior: catalog.exterior.default,
  interior: catalog.interior.default,
  personalization: { text: "", placement: catalog.personalization.defaultPlacement },
});

/** Every leather piece at its catalog default (pieces are not customer choices). */
export const defaultPieces = (catalog: Catalog): Record<string, PieceChoice> =>
  Object.fromEntries(catalog.pieces.map((p) => [p.id, { ...p.default }]));

export const viewFromPreset = (catalog: Catalog, presetId: string): ViewState => {
  const preset = catalog.presentation.views.find((v) => v.id === presetId) ?? catalog.presentation.views[0];
  return { preset: preset.id, azimuth: preset.azimuth, elevation: preset.elevation, lidAngle: preset.lidAngle };
};

export const defaultRenderProps = (catalog: Catalog): RenderProps => ({
  configuration: defaultConfiguration(catalog),
  view: viewFromPreset(catalog, catalog.presentation.defaultView),
});

/* ------------------------------------------------------------------ */

export interface ResolvedMaterial {
  /** Stable key, e.g. "suede/beige". */
  key: string;
  material: MaterialOption;
  color: ColorOption;
  /** Final base colour for this material (colour tone override applied). */
  hex: string;
  stitchHex: string;
}

export interface ResolvedAppearance {
  exterior: ResolvedMaterial;
  interior: ResolvedMaterial;
  pieces: Record<string, ResolvedMaterial>;
}

const resolvedMaterial = (catalog: Catalog, materialId: string, colorId: string): ResolvedMaterial | null => {
  const material = catalog.materials.find((m) => m.id === materialId);
  const color = catalog.colors.find((c) => c.id === colorId);
  if (!material || !color) return null;
  return {
    key: `${material.id}/${color.id}`,
    material,
    color,
    hex: color.tones?.[material.id] ?? color.hex,
    stitchHex: color.stitch,
  };
};

interface MatchContext {
  exterior: string;
  interior: string;
  pieces: Record<string, PieceChoice>;
}

/** Follows match tokens until a concrete colour id is found. */
const resolveColorId = (context: MatchContext, start: string, pieceId: string): { ok: true; colorId: string } | { ok: false; issue: Issue } => {
  const chain = [pieceId];
  let token = start;
  for (let guard = 0; guard < 32; guard++) {
    if (!token.startsWith(MATCH_PREFIX)) return { ok: true, colorId: token };
    const target = token.slice(MATCH_PREFIX.length);
    if (target === "exterior") return { ok: true, colorId: context.exterior };
    if (target === "interior") return { ok: true, colorId: context.interior };
    if (chain.includes(target)) {
      return {
        ok: false,
        issue: { path: `pieces.${pieceId}.color`, code: "match_cycle", message: `Circular colour match: ${[...chain, target].join(" → ")}.` },
      };
    }
    const next = context.pieces[target];
    if (!next) {
      return {
        ok: false,
        issue: { path: `pieces.${pieceId}.color`, code: "unknown_match_target", message: `"${token}" refers to unknown "${target}".` },
      };
    }
    chain.push(target);
    token = next.color;
  }
  return { ok: false, issue: { path: `pieces.${pieceId}.color`, code: "match_cycle", message: "Colour match chain is too long." } };
};

/* ------------------------------------------------------------------ */

export interface ValidConfiguration {
  configuration: Configuration;
  product: Product;
  appearance: ResolvedAppearance;
}

export interface ValidationOptions {
  /** Final render or order (not the live preview): a chosen logo must have been uploaded. */
  final?: boolean;
}

/**
 * Validates a configuration against the catalog and resolves its materials.
 * Leather pieces always use their catalog defaults; a configuration may still
 * list them (saved before the Leather details step was removed), but only with
 * those defaults. Unknown pieces, colours or materials are errors.
 */
export const validateConfiguration = (
  catalog: Catalog,
  input: unknown,
  path = "configuration",
  options: ValidationOptions = {},
): Result<ValidConfiguration> => {
  const parsed = configurationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error, path) };

  const raw = parsed.data;
  const issues: Issue[] = [];
  const add = (p: string, code: string, message: string) => issues.push({ path: `${path}.${p}`, code, message });

  const product = findProduct(catalog, raw.product);
  if (!product) add("product", "unknown_product", `Unknown product "${raw.product}".`);
  if (!catalog.exterior.colors.includes(raw.exterior)) {
    add("exterior", "color_not_offered", `Exterior colour "${raw.exterior}" is not offered.`);
  }
  if (!catalog.interior.colors.includes(raw.interior)) {
    add("interior", "color_not_offered", `Interior colour "${raw.interior}" is not offered.`);
  }

  for (const [id, requested] of Object.entries(raw.pieces ?? {})) {
    const piece = catalog.pieces.find((p) => p.id === id);
    if (!piece) {
      add(`pieces.${id}`, "unknown_piece", `Unknown leather piece "${id}".`);
    } else if (requested.material !== piece.default.material || requested.color !== piece.default.color) {
      add(`pieces.${id}`, "piece_not_selectable", `The ${piece.label.toLowerCase()} can't be customised; it always uses its default.`);
    }
  }
  const pieces = defaultPieces(catalog);

  const placement = raw.personalization.placement;
  if (!catalog.personalization.placements.some((p) => p.id === placement)) {
    add("personalization.placement", "unknown_placement", `Unknown personalization placement "${placement}".`);
  }
  const personalization = validatePersonalization(
    raw.personalization.text,
    catalog.personalization,
    product,
    `${path}.personalization.text`,
  );
  if (!personalization.ok) issues.push(...personalization.issues);

  const logo = validateLogo(raw.logo, catalog.logo, `${path}.logo`, { requireArtwork: options.final });
  if (!logo.ok) issues.push(...logo.issues);

  if (issues.length > 0 || !product) return { ok: false, issues };

  const configuration: Configuration = {
    product: raw.product,
    exterior: raw.exterior,
    interior: raw.interior,
    personalization: { text: personalization.ok ? personalization.value : "", placement },
    ...(logo.ok && logo.value ? { logo: logo.value } : {}),
  };

  // Resolve materials (match tokens may point at other pieces).
  const matchContext: MatchContext = { exterior: configuration.exterior, interior: configuration.interior, pieces };
  const resolvedPieces: Record<string, ResolvedMaterial> = {};
  for (const piece of catalog.pieces) {
    const choice = pieces[piece.id];
    const colorId = resolveColorId(matchContext, choice.color, piece.id);
    if (!colorId.ok) {
      issues.push({ ...colorId.issue, path: `${path}.${colorId.issue.path}` });
      continue;
    }
    if (!piece.colors.includes(colorId.colorId)) {
      add(
        `pieces.${piece.id}.color`,
        "color_not_offered",
        `"${choice.color}" resolves to "${colorId.colorId}", which is not offered for ${piece.label.toLowerCase()}.`,
      );
      continue;
    }
    const resolved = resolvedMaterial(catalog, choice.material, colorId.colorId);
    if (resolved) resolvedPieces[piece.id] = resolved;
  }
  const exterior = resolvedMaterial(catalog, catalog.exterior.material, configuration.exterior);
  const interior = resolvedMaterial(catalog, catalog.interior.material, configuration.interior);
  if (issues.length > 0 || !exterior || !interior) return { ok: false, issues };

  return { ok: true, value: { configuration, product, appearance: { exterior, interior, pieces: resolvedPieces } } };
};

export interface ValidRenderProps extends ValidConfiguration {
  view: ViewState;
}

/** Validates the full composition input (configuration + camera view). */
export const validateRenderProps = (catalog: Catalog, input: unknown, options: ValidationOptions = {}): Result<ValidRenderProps> => {
  const parsed = renderPropsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const config = validateConfiguration(catalog, parsed.data.configuration, "configuration", options);
  const issues: Issue[] = config.ok ? [] : [...config.issues];

  const { view } = parsed.data;
  const cam = catalog.presentation.camera;
  if (!catalog.presentation.views.some((v) => v.id === view.preset)) {
    issues.push({ path: "view.preset", code: "unknown_view", message: `Unknown view "${view.preset}".` });
  }
  if (view.elevation < cam.minElevation || view.elevation > cam.maxElevation) {
    issues.push({
      path: "view.elevation",
      code: "out_of_range",
      message: `Elevation must be between ${cam.minElevation}° and ${cam.maxElevation}°.`,
    });
  }
  if (view.lidAngle < 0 || view.lidAngle > 115) {
    issues.push({ path: "view.lidAngle", code: "out_of_range", message: "Lid angle must be between 0° and 115°." });
  }
  if (!config.ok || issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { ...config.value, view: { ...view, azimuth: ((view.azimuth % 360) + 360) % 360 } } };
};

export class InvalidConfigurationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`Invalid configuration:\n${issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")}`);
    this.name = "InvalidConfigurationError";
  }
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

/** Hex shown for a surface swatch (applies the surface material's tone). */
export const surfaceSwatchHex = (catalog: Catalog, surface: "exterior" | "interior", colorId: string): string => {
  const color = catalog.colors.find((c) => c.id === colorId);
  return color?.tones?.[catalog[surface].material] ?? color?.hex ?? "#000000";
};

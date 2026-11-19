/**
 * Customer configuration: defaults, validation against the catalog, and
 * resolution of "match:" colour tokens into concrete materials.
 */
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
  pieces: Object.fromEntries(catalog.pieces.map((p) => [p.id, { ...p.default }])),
  personalization: { text: "", placement: catalog.personalization.defaultPlacement },
});

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

/** Follows match tokens until a concrete colour id is found. */
const resolveColorId = (
  configuration: Configuration,
  start: string,
  pieceId: string,
): { ok: true; colorId: string } | { ok: false; issue: Issue } => {
  const chain = [pieceId];
  let token = start;
  for (let guard = 0; guard < 32; guard++) {
    if (!token.startsWith(MATCH_PREFIX)) return { ok: true, colorId: token };
    const target = token.slice(MATCH_PREFIX.length);
    if (target === "exterior") return { ok: true, colorId: configuration.exterior };
    if (target === "interior") return { ok: true, colorId: configuration.interior };
    if (chain.includes(target)) {
      return {
        ok: false,
        issue: { path: `pieces.${pieceId}.color`, code: "match_cycle", message: `Circular colour match: ${[...chain, target].join(" → ")}.` },
      };
    }
    const next = configuration.pieces[target];
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

/**
 * Validates a configuration against the catalog. Missing pieces are filled
 * with their catalog defaults (so saved configurations survive catalog
 * additions); unknown pieces, colours or materials are errors.
 */
export const validateConfiguration = (catalog: Catalog, input: unknown, path = "configuration"): Result<ValidConfiguration> => {
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

  const pieces: Record<string, PieceChoice> = {};
  for (const id of Object.keys(raw.pieces)) {
    if (!catalog.pieces.some((p) => p.id === id)) add(`pieces.${id}`, "unknown_piece", `Unknown leather piece "${id}".`);
  }
  for (const piece of catalog.pieces) {
    const choice = raw.pieces[piece.id] ?? piece.default;
    pieces[piece.id] = { ...choice };
    if (!piece.materials.includes(choice.material)) {
      add(`pieces.${piece.id}.material`, "material_not_offered", `"${choice.material}" is not offered for ${piece.label.toLowerCase()}.`);
    }
    if (!choice.color.startsWith(MATCH_PREFIX) && !piece.colors.includes(choice.color)) {
      add(`pieces.${piece.id}.color`, "color_not_offered", `"${choice.color}" is not offered for ${piece.label.toLowerCase()}.`);
    }
  }

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

  if (issues.length > 0 || !product) return { ok: false, issues };

  const configuration: Configuration = {
    product: raw.product,
    exterior: raw.exterior,
    interior: raw.interior,
    pieces,
    personalization: { text: personalization.ok ? personalization.value : "", placement },
  };

  // Resolve materials (match tokens may point at other pieces).
  const resolvedPieces: Record<string, ResolvedMaterial> = {};
  for (const piece of catalog.pieces) {
    const choice = pieces[piece.id];
    const colorId = resolveColorId(configuration, choice.color, piece.id);
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
export const validateRenderProps = (catalog: Catalog, input: unknown): Result<ValidRenderProps> => {
  const parsed = renderPropsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const config = validateConfiguration(catalog, parsed.data.configuration);
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

export interface PieceColorChoice {
  /** Value stored in the configuration: a colour id or a match token. */
  value: string;
  label: string;
  /** Colour it currently resolves to (for the swatch). */
  colorId: string;
  hex: string;
  isMatch: boolean;
}

const matchLabel = (catalog: Catalog, target: string) => {
  if (target === "exterior" || target === "interior") return `Match ${target}`;
  const piece = catalog.pieces.find((p) => p.id === target);
  return `Match ${piece ? piece.label.toLowerCase() : target}`;
};

/**
 * Colour choices for a leather piece: the match tokens that currently resolve to
 * an offered colour, followed by the piece's own palette.
 */
export const pieceColorChoices = (catalog: Catalog, configuration: Configuration, pieceId: string): PieceColorChoice[] => {
  const piece = catalog.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  const material = configuration.pieces[pieceId]?.material ?? piece.default.material;
  const tone = (colorId: string) => {
    const color = catalog.colors.find((c) => c.id === colorId);
    return color?.tones?.[material] ?? color?.hex ?? "#000000";
  };
  const tokens = new Set<string>([`${MATCH_PREFIX}interior`, `${MATCH_PREFIX}exterior`]);
  if (piece.default.color.startsWith(MATCH_PREFIX)) tokens.add(piece.default.color);
  const choices: PieceColorChoice[] = [];
  for (const token of tokens) {
    const resolved = resolveColorId(configuration, token, pieceId);
    if (resolved.ok && piece.colors.includes(resolved.colorId)) {
      choices.push({
        value: token,
        label: matchLabel(catalog, token.slice(MATCH_PREFIX.length)),
        colorId: resolved.colorId,
        hex: tone(resolved.colorId),
        isMatch: true,
      });
    }
  }
  for (const colorId of piece.colors) {
    const color = catalog.colors.find((c) => c.id === colorId);
    if (color) choices.push({ value: colorId, label: color.name, colorId, hex: tone(colorId), isMatch: false });
  }
  return choices;
};

/** Hex shown for a surface swatch (applies the surface material's tone). */
export const surfaceSwatchHex = (catalog: Catalog, surface: "exterior" | "interior", colorId: string): string => {
  const color = catalog.colors.find((c) => c.id === colorId);
  return color?.tones?.[catalog[surface].material] ?? color?.hex ?? "#000000";
};

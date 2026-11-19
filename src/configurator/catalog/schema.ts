/**
 * Zod schemas for the editable options catalog (config/options.ts) and for a
 * customer configuration. Structural checks live here; cross-reference checks
 * (ids that must exist, defaults inside palettes, dimension sums, …) live in
 * loadCatalog.ts.
 */
import { z } from "zod";

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids must be kebab-case (a-z, 0-9, -)");

const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "colours must be #RRGGBB hex values");
const unit = z.number().min(0).max(1);
const positive = z.number().positive();
const nonNegative = z.number().min(0);

/* ------------------------------------------------------------------ */
/* Products (geometry comes straight from the blueprints, in cm)       */
/* ------------------------------------------------------------------ */

export const dimensionsSchema = z.object({
  outer: z.object({ length: positive, depth: positive, height: positive }),
  baseHeight: positive,
  lidHeight: positive,
  floor: positive,
  walls: z.object({
    /** Left/right end walls (along the length). */
    end: positive,
    /** Front/back walls. */
    side: positive,
  }),
  compartments: z.object({
    count: z.number().int().min(1).max(12),
    width: positive,
    divider: positive,
  }),
  cushion: z.object({
    width: positive,
    depth: positive,
    height: positive,
    /** Extra cut so the cushion sits snug (blueprint: 1–2 mm). */
    oversize: nonNegative,
  }),
  /** Zip line distance from the outer edge, measured on the rim. */
  zipInset: positive,
  lid: z.object({
    /** Lid wall thickness (lid inside view). */
    wall: positive,
    pocket: z.object({
      width: positive,
      usableWidth: positive,
      height: positive,
      depth: positive,
    }),
    flapHeight: positive,
    strap: z.object({
      width: positive,
      /** Snap centre distance from the inner front edge of the lid. */
      snapFromEdge: positive,
    }),
    /** Padded pocket face (blueprint: 3 mm). */
    padding: positive,
    /** Stiff board behind the padding (blueprint: 1 mm). */
    board: positive,
  }),
  /** Informational: maximum watch thickness the box is designed for. */
  maxWatchThickness: positive,
});

export const productSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  subtitle: z.string().min(1),
  dimensions: dimensionsSchema,
  engraving: z.object({
    /** Area on the lid top, centred, that personalization is fitted into. */
    widthCm: positive,
    heightCm: positive,
    /** Optional per-product override of personalization.maxLength. */
    maxLength: z.number().int().positive().optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* Colours and leather/suede materials                                  */
/* ------------------------------------------------------------------ */

export const colorSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Base colour (sRGB). */
  hex: hexSchema,
  /** Thread colour used for stitching on pieces in this colour. */
  stitch: hexSchema,
  /** Optional per-material shade, e.g. suede usually reads lighter. Keyed by material id. */
  tones: z.record(z.string(), hexSchema).optional(),
});

export const finishSchema = z.enum(["pebbled", "smooth", "suede"]);

export const materialSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  finish: finishSchema,
  /** PBR parameters for three.js MeshPhysicalMaterial. */
  pbr: z.object({
    roughness: unit,
    clearcoat: unit,
    clearcoatRoughness: unit,
    sheen: unit,
    sheenRoughness: unit,
    specularIntensity: unit,
  }),
  /** Procedural surface grain (object-space, resolution independent). */
  grain: z.object({
    /** Cell size of the grain in cm. */
    scaleCm: positive,
    /** Normal perturbation strength (0 = perfectly smooth). */
    strength: z.number().min(0).max(2),
    /** Roughness variation between grain tops and creases. */
    roughnessVariation: unit,
    /** Low-frequency colour variation. */
    mottle: unit,
    /** Darkening inside grain creases. */
    creaseDarkening: unit,
  }),
});

export const surfaceSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  material: idSchema,
  colors: z.array(idSchema).min(1),
  default: idSchema,
});

/** A piece colour is either a colour id or a match token such as "match:interior". */
export const MATCH_PREFIX = "match:";

export const pieceSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  materials: z.array(idSchema).min(1),
  colors: z.array(idSchema).min(1),
  default: z.object({ material: idSchema, color: z.string().min(1) }),
});

/* ------------------------------------------------------------------ */
/* Personalization                                                     */
/* ------------------------------------------------------------------ */

export const personalizationRulesSchema = z.object({
  enabled: z.boolean(),
  minLength: z.number().int().min(1),
  maxLength: z.number().int().min(1),
  /** Regular expression (string, compiled with the "u" flag) the whole text must match. */
  allowedPattern: z.string().min(1),
  /** Human readable description of the allowed characters, shown in the UI. */
  allowedDescription: z.string().min(1),
  trim: z.boolean(),
  collapseWhitespace: z.boolean(),
  uppercase: z.boolean(),
  placements: z
    .array(z.object({ id: idSchema, label: z.string().min(1) }))
    .min(1),
  defaultPlacement: idSchema,
  font: z.object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900),
    /** Files in public/ (served by staticFile()). */
    files: z
      .array(z.object({ path: z.string().min(1), unicodeRange: z.string().optional() }))
      .min(1),
    fallback: z.string().min(1),
    letterSpacingEm: z.number().min(0).max(1),
  }),
  deboss: z.object({
    /** Largest cap height in cm; long names are scaled down to fit the area. */
    maxCapHeightCm: positive,
    /** Normal-map strength of the pressed edge. */
    depth: z.number().min(0).max(10),
    /** How much darker the pressed leather reads (0–1). */
    darkening: unit,
    /** Width of the pressed edge in cm. */
    edgeSoftnessCm: positive,
    /** Roughness multiplier inside the pressing (burnished = smoother). */
    roughnessFactor: z.number().min(0).max(2),
  }),
});

/* ------------------------------------------------------------------ */
/* Construction / presentation constants that the blueprints leave open */
/* ------------------------------------------------------------------ */

export const constructionSchema = z.object({
  /** Plan-view radius of the vertical box corners. */
  cornerRadius: positive,
  baseTopEdgeRadius: positive,
  baseBottomEdgeRadius: positive,
  lidBottomEdgeRadius: positive,
  lidTopEdgeRadius: positive,
  cavityCornerRadius: positive,
  /** Leather band visible inside the rim before the suede lining starts. */
  rimBandDepth: positive,
  rimFilletRadius: positive,
  /** Lid shell (top) thickness. */
  lidShellThickness: positive,
  /** How far the pocket face sits back from the lid rim plane. */
  pocketFaceRecess: nonNegative,
  /** How far the flap sits behind the pocket face. */
  flapRecess: nonNegative,
  strapThickness: positive,
  snapCapRadius: positive,
  cushionCornerRadius: positive,
  cushionEndRadius: positive,
  dividerHeightOffset: z.number(),
  stitch: z.object({
    length: positive,
    spacing: positive,
    width: positive,
    baseTopFromRim: positive,
    baseBottomFromFloor: positive,
    lidWallFromRim: positive,
    pocketInset: positive,
    flapFromEdge: positive,
  }),
  zip: z.object({
    /** The zip runs front + both ends and stops this far from the back edge. */
    endDistanceFromBackCm: positive,
    /** Side of the box the slider and pull tab are parked on. */
    pullSide: z.enum(["left", "right"]),
    toothPitch: positive,
    tapeWidth: positive,
  }),
});

export const presentationSchema = z.object({
  output: z.object({
    width: z.number().int().min(320).max(4096),
    height: z.number().int().min(320).max(4096),
    /** Device scale factor for the final render (2 → 3200×2000 for a 1600×1000 composition). */
    renderScale: z.number().min(1).max(4),
  }),
  background: z.object({ center: hexSchema, edge: hexSchema }),
  environment: z.object({
    /** Optional equirectangular .hdr in public/. null = built-in procedural studio. */
    hdriPath: z.string().min(1).nullable(),
    intensity: z.number().min(0).max(5),
    exposure: z.number().min(0.1).max(4),
  }),
  hardware: z.object({
    name: z.string().min(1),
    hex: hexSchema,
    roughness: unit,
  }),
  zipTape: z.object({ darkenExterior: unit }),
  views: z
    .array(
      z.object({
        id: idSchema,
        label: z.string().min(1),
        azimuth: z.number(),
        elevation: z.number().min(1).max(89),
        lidAngle: z.number().min(0).max(115),
      }),
    )
    .min(1),
  defaultView: idSchema,
  /** View the preview turns to when the customer starts typing a personalization. */
  personalizationView: idSchema,
  camera: z.object({
    fov: z.number().min(10).max(60),
    framingMargin: z.number().min(0).max(0.5),
    /** Moves the product up in the frame (fraction of frame height) to leave floor for its shadow. */
    verticalOffset: z.number().min(-0.3).max(0.3),
    minElevation: z.number().min(1).max(89),
    maxElevation: z.number().min(1).max(89),
  }),
});

export const catalogSchema = z.object({
  version: z.number().int().positive(),
  products: z.array(productSchema).min(1),
  defaultProduct: idSchema,
  colors: z.array(colorSchema).min(1),
  materials: z.array(materialSchema).min(1),
  exterior: surfaceSchema,
  interior: surfaceSchema,
  pieces: z.array(pieceSchema),
  personalization: personalizationRulesSchema,
  construction: constructionSchema,
  presentation: presentationSchema,
});

export type CatalogInput = z.input<typeof catalogSchema>;
export type Catalog = z.output<typeof catalogSchema>;
export type Product = z.output<typeof productSchema>;
export type Dimensions = z.output<typeof dimensionsSchema>;
export type ColorOption = z.output<typeof colorSchema>;
export type MaterialOption = z.output<typeof materialSchema>;
export type Finish = z.output<typeof finishSchema>;
export type Surface = z.output<typeof surfaceSchema>;
export type Piece = z.output<typeof pieceSchema>;
export type PersonalizationRules = z.output<typeof personalizationRulesSchema>;
export type Construction = z.output<typeof constructionSchema>;
export type Presentation = z.output<typeof presentationSchema>;
export type ViewPreset = Presentation["views"][number];

/* ------------------------------------------------------------------ */
/* Customer configuration (render input props)                          */
/* ------------------------------------------------------------------ */

export const pieceChoiceSchema = z.object({
  material: z.string(),
  color: z.string(),
});

export const configurationSchema = z.object({
  product: z.string(),
  exterior: z.string(),
  interior: z.string(),
  pieces: z.record(z.string(), pieceChoiceSchema),
  personalization: z.object({
    text: z.string().max(200),
    placement: z.string(),
  }),
});

export const viewStateSchema = z.object({
  preset: z.string(),
  azimuth: z.number().finite(),
  elevation: z.number().finite(),
  lidAngle: z.number().finite(),
});

/** Props of the Remotion still composition, shared by the live preview and the final render. */
export const renderPropsSchema = z.object({
  configuration: configurationSchema,
  view: viewStateSchema,
});

export type PieceChoice = z.output<typeof pieceChoiceSchema>;
export type Configuration = z.output<typeof configurationSchema>;
export type ViewState = z.output<typeof viewStateSchema>;
export type RenderProps = z.output<typeof renderPropsSchema>;

/** A single validation problem, addressed by a dotted path. */
export interface Issue {
  path: string;
  code: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

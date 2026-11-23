/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WATCH BOX CONFIGURATOR — OPTIONS CATALOG
 * ─────────────────────────────────────────────────────────────────────────────
 *  This is the single place to edit products, colours, leathers, leather pieces,
 *  personalization rules and presentation settings. No 3D code needs to change.
 *
 *  The catalog is validated when it is loaded (src/catalog/loadCatalog.ts):
 *  unknown ids, defaults outside a palette, circular "match:" references,
 *  blueprint dimensions that don't add up, invalid regexes, etc. all fail fast
 *  with a readable list of issues — in the configurator, in Remotion Studio and
 *  in the render endpoint.
 *
 *  Units: centimetres for all geometry. Colours: sRGB hex.
 *  Ids: kebab-case. Display names can be anything.
 *
 *  Recipes
 *   • New colour: add it to `colors`, then add its id to the `colors` list of
 *     every surface / piece that should offer it.
 *   • New leather: add a `materials` entry (finish: pebbled | smooth | suede),
 *     then list its id in `pieces[].materials` where it should be offered.
 *   • A piece colour can be a colour id or a match token: "match:exterior",
 *     "match:interior" or "match:<piece id>" (e.g. the snap cap follows the strap).
 *   • Personalization limits: `personalization` (global) and
 *     `products[].engraving.maxLength` (per product override).
 *   • Logo: `logo` (modes, neutral colours, upload rules) and `products[].logo`
 *     (the area in the middle of the lid the logo is fitted into).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { CatalogInput } from "../catalog/schema";

export const options = {
  version: 1,

  /* ─────────────────────────── Products ─────────────────────────── */
  // Dimensions are transcribed from the blueprints and are authoritative.
  products: [
    {
      id: "duo",
      name: "Duo",
      subtitle: "2-watch box",
      dimensions: {
        outer: { length: 16, depth: 9, height: 7.5 },
        baseHeight: 6,
        lidHeight: 1.5,
        floor: 1,
        walls: { end: 1.75, side: 1 },
        compartments: { count: 2, width: 5.5, divider: 1.5 },
        cushion: { width: 5.5, depth: 6, height: 4, oversize: 0.15 },
        zipInset: 0.5,
        lid: {
          wall: 1,
          pocket: { width: 13.5, usableWidth: 13, height: 5.5, depth: 0.8 },
          flapHeight: 1.5,
          strap: { width: 1.2, snapFromEdge: 3.5 },
          padding: 0.3,
          board: 0.1,
        },
        maxWatchThickness: 1.2,
      },
      // Fitted area on the pocket front, centred below the snap (see README).
      engraving: { widthCm: 9, heightCm: 1.8, maxLength: 15 },
      // Middle of the outside of the lid; the logo is fitted inside, aspect kept.
      logo: { widthCm: 7, heightCm: 4 },
    },
    {
      id: "quartet-slim",
      name: "Quartet Slim",
      subtitle: "4-watch box",
      dimensions: {
        outer: { length: 26.5, depth: 9, height: 7.5 },
        baseHeight: 6,
        lidHeight: 1.5,
        floor: 1,
        walls: { end: 1, side: 1 },
        compartments: { count: 4, width: 5, divider: 1.5 },
        cushion: { width: 4.5, depth: 6, height: 4, oversize: 0.15 },
        zipInset: 0.5,
        lid: {
          wall: 1,
          // Usable width is not on the blueprint; assumed 0.5 cm less, as on the Duo.
          pocket: { width: 24, usableWidth: 23.5, height: 5.5, depth: 0.8 },
          flapHeight: 1.5,
          strap: { width: 1.2, snapFromEdge: 3.5 },
          padding: 0.3,
          board: 0.1,
        },
        maxWatchThickness: 1.2,
      },
      engraving: { widthCm: 14, heightCm: 1.8, maxLength: 18 },
      logo: { widthCm: 9, heightCm: 4 },
    },
  ],
  defaultProduct: "duo",

  /* ─────────────────────────── Colours ──────────────────────────── */
  colors: [
    { id: "money-green", name: "Money green", hex: "#0f4a32", stitch: "#d6c9a6", tones: { suede: "#145a3d", nappa: "#11513a" } },
    { id: "cognac", name: "Cognac", hex: "#7b4322", stitch: "#ead9b8", tones: { suede: "#a5663a" } },
    { id: "black", name: "Black", hex: "#19191a", stitch: "#3b3b3d", tones: { suede: "#202022" } },
    { id: "dark-brown", name: "Dark brown", hex: "#3a2416", stitch: "#cdb38c", tones: { suede: "#4a3020" } },
    { id: "navy", name: "Navy", hex: "#20273a", stitch: "#e3d3b2", tones: { suede: "#2a3350" } },
    { id: "signal-orange", name: "Signal orange", hex: "#e0621c", stitch: "#a8450f" },
    { id: "light-blue", name: "Light blue", hex: "#9cb7d2", stitch: "#7894b2" },
    { id: "beige", name: "Beige", hex: "#dcc6a4", stitch: "#bea681" },
    { id: "red", name: "Red", hex: "#7a1420", stitch: "#4e0c14", tones: { suede: "#741320" } },
  ],

  /* ─────────────────────────── Materials ────────────────────────── */
  // PBR values are tuned for the built-in studio lighting; see README "Assumptions".
  materials: [
    {
      id: "full-grain",
      name: "Full-grain leather",
      finish: "pebbled",
      pbr: { roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.6, specularIntensity: 0.55 },
      grain: { scaleCm: 0.17, strength: 0.09, roughnessVariation: 0.1, mottle: 0.05, creaseDarkening: 0.12 },
    },
    {
      id: "nappa",
      name: "Smooth nappa leather",
      finish: "smooth",
      pbr: { roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.15, sheenRoughness: 0.5, specularIntensity: 0.6 },
      grain: { scaleCm: 0.12, strength: 0.012, roughnessVariation: 0.04, mottle: 0.03, creaseDarkening: 0.02 },
    },
    {
      id: "suede",
      name: "Suede",
      finish: "suede",
      pbr: { roughness: 0.96, clearcoat: 0, clearcoatRoughness: 0.9, sheen: 0.7, sheenRoughness: 0.55, specularIntensity: 0.18 },
      grain: { scaleCm: 0.07, strength: 0.03, roughnessVariation: 0.05, mottle: 0.06, creaseDarkening: 0.03 },
    },
  ],

  /* ─────────────────────────── Surfaces ─────────────────────────── */
  exterior: {
    label: "Exterior",
    description: "Full-grain leather",
    material: "full-grain",
    colors: ["money-green", "cognac", "black", "dark-brown", "navy"],
    default: "navy",
  },
  interior: {
    label: "Interior",
    description: "Suede lining",
    material: "suede",
    colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black"],
    default: "beige",
  },

  /* ─────────────────────────── Leather pieces ───────────────────── */
  pieces: [
    {
      id: "cushions",
      label: "Watch cushions",
      materials: ["suede", "nappa"],
      colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black", "dark-brown"],
      default: { material: "suede", color: "match:interior" },
    },
    {
      id: "pocket",
      label: "Lid pocket",
      description: "Padded pocket front inside the lid",
      materials: ["suede", "nappa"],
      colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black", "dark-brown"],
      default: { material: "suede", color: "match:interior" },
    },
    {
      id: "flap",
      label: "Lid flap",
      description: "Tuck-in flap over the pocket opening",
      materials: ["suede", "nappa"],
      colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black", "dark-brown"],
      default: { material: "suede", color: "match:pocket" },
    },
    {
      id: "strap",
      label: "Lid strap",
      materials: ["nappa", "full-grain"],
      colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black", "dark-brown"],
      default: { material: "nappa", color: "match:interior" },
      // Always follows the interior; named in the Interior step note.
      selectable: false,
    },
    {
      id: "snap-cap",
      label: "Snap cap",
      description: "Leather-covered push fastener",
      materials: ["nappa", "full-grain"],
      colors: ["signal-orange", "money-green", "navy", "light-blue", "beige", "cognac", "red", "black", "dark-brown"],
      default: { material: "nappa", color: "match:interior" },
      selectable: false,
    },
    {
      id: "zip-pull",
      label: "Zip pull tab",
      materials: ["full-grain", "nappa"],
      colors: ["money-green", "cognac", "black", "dark-brown", "navy", "signal-orange", "light-blue", "beige", "red"],
      default: { material: "full-grain", color: "match:exterior" },
    },
  ],

  /* ─────────────────────────── Personalization ──────────────────── */
  personalization: {
    enabled: true,
    minLength: 1,
    maxLength: 15, // per-product overrides: products[].engraving.maxLength
    // Latin letters incl. accents, digits, space and . & ' ’ -
    allowedPattern: "^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ž .&'’\\-]+$",
    allowedDescription: "Use letters (accents are fine), digits, spaces, full stops, ampersands, apostrophes and hyphens",
    trim: true,
    collapseWhitespace: true,
    uppercase: false,
    // Pressed into the inside of the lid. "lid-top" (outside of the lid) is also
    // supported by the scene; add it here to offer it.
    placements: [{ id: "lid-inside", label: "Inside the lid" }],
    defaultPlacement: "lid-inside",
    font: {
      family: "Engraving Serif",
      weight: 600,
      files: [
        { path: "fonts/engraving-serif-600.woff2", unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212" },
        { path: "fonts/engraving-serif-600-ext.woff2", unicodeRange: "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
      ],
      fallback: "Georgia, 'Times New Roman', serif",
      letterSpacingEm: 0.14,
    },
    deboss: {
      maxCapHeightCm: 0.65,
      depth: 4.5,
      darkening: 0.38,
      edgeSoftnessCm: 0.035,
      roughnessFactor: 0.75,
    },
  },

  /* ─────────────────────────── Logo ─────────────────────────────── */
  // For corporate orders: the customer's logo, as uploaded (a plain background
  // removed), printed in full colour or in one colour in the middle of the
  // outside of the lid. Area per product: products[].logo.
  logo: {
    enabled: true,
    label: "Logo",
    description: "For corporate orders: your logo, printed in the middle of the outside of the lid.",
    modes: [
      { id: "full-color", label: "Full colour", description: "Printed in its own colours, as uploaded." },
      { id: "one-color", label: "One colour", description: "The whole logo printed in one colour." },
    ],
    // One-colour prints. Labels are shown exactly as written.
    colors: [
      { id: "zilver", label: "zilver", hex: "#c9ccd1", finish: "metallic", roughness: 0.3 },
      { id: "wit", label: "wit", hex: "#f2f1ec", finish: "matte", roughness: 0.6 },
      { id: "zwart", label: "zwart", hex: "#141416", finish: "matte", roughness: 0.55 },
      { id: "goud", label: "goud", hex: "#d2ab5f", finish: "metallic", roughness: 0.3 },
    ],
    defaultColor: "zilver",
    upload: {
      formats: ["png", "jpeg", "svg"],
      maxFileSizeMb: 10,
      minLongestSidePx: 500,
      previewMaxPx: 1024,
    },
    print: { roughness: 0.42 },
  },

  /* ─────────────────────────── Construction ─────────────────────── */
  // Values the blueprints don't specify (radii, recesses, stitch layout).
  construction: {
    cornerRadius: 1.1,
    baseTopEdgeRadius: 0.32,
    baseBottomEdgeRadius: 0.4,
    lidBottomEdgeRadius: 0.32,
    lidTopEdgeRadius: 0.45,
    cavityCornerRadius: 0.35,
    rimBandDepth: 0.55,
    rimFilletRadius: 0.16,
    lidShellThickness: 0.25,
    pocketFaceRecess: 0.12,
    flapRecess: 0.16,
    strapThickness: 0.12,
    snapCapRadius: 0.42,
    cushionCornerRadius: 1.85,
    cushionEndRadius: 0.45,
    dividerHeightOffset: -0.55,
    stitch: {
      length: 0.26,
      spacing: 0.4,
      width: 0.055,
      baseTopFromRim: 0.6,
      baseBottomFromFloor: 0.55,
      lidWallFromRim: 0.75,
      pocketInset: 0.32,
      flapFromEdge: 0.38,
    },
    zip: {
      endDistanceFromBackCm: 1.2,
      pullSide: "left",
      toothPitch: 0.17,
      tapeWidth: 0.42,
    },
  },

  /* ─────────────────────────── Presentation ─────────────────────── */
  presentation: {
    output: { width: 1600, height: 1000, renderScale: 2 },
    background: { center: "#fbfbfa", edge: "#e2e2df" },
    environment: { hdriPath: null, intensity: 1.0, exposure: 1.0 },
    hardware: { name: "Polished silver", hex: "#d6d8db", roughness: 0.24 },
    zipTape: { darkenExterior: 0.45 },
    views: [
      { id: "open", label: "Open", azimuth: 30, elevation: 31, lidAngle: 104 },
      { id: "closed", label: "Closed", azimuth: 32, elevation: 36, lidAngle: 0 },
      { id: "top", label: "Top", azimuth: 0, elevation: 76, lidAngle: 0 },
      { id: "front", label: "Front", azimuth: 0, elevation: 22, lidAngle: 104 },
      { id: "side", label: "Side", azimuth: 72, elevation: 24, lidAngle: 104 },
    ],
    defaultView: "open",
    personalizationView: "open",
    logoView: "closed",
    camera: { fov: 24, framingMargin: 0.07, verticalOffset: 0.045, minElevation: 6, maxElevation: 84 },
  },
} satisfies CatalogInput;

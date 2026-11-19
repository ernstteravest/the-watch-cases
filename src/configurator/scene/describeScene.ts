/**
 * The single scene definition. Turns a validated configuration + view into
 * everything the 3D scene needs (layout, resolved materials, engraving,
 * lighting, camera). Pure and deterministic: the live preview and the final
 * render both go through this function — see tests/sharedScene.test.tsx.
 */
import type { ResolvedAppearance, ResolvedMaterial, ValidRenderProps } from "../catalog/configuration";
import type { Catalog, Construction, PersonalizationRules, Presentation } from "../catalog/schema";
import { computeBoxLayout, isEngravingPlacement, withEngravingArea, type BoxLayout, type EngravingAnchor } from "../geometry/layout";
import { computeCamera, type CameraSetup } from "./camera";
import { darken } from "./materials/leatherMaterial";

export interface EngravingDescription {
  text: string;
  anchor: EngravingAnchor;
  /** Leather the text is pressed into (pocket front by default). */
  material: ResolvedMaterial;
  font: PersonalizationRules["font"];
  deboss: PersonalizationRules["deboss"];
}

export interface SceneDescription {
  productId: string;
  layout: BoxLayout;
  construction: Construction;
  appearance: ResolvedAppearance;
  stitch: { exterior: string; pocket: string; flap: string };
  tapeHex: string;
  hardware: Presentation["hardware"];
  engraving: EngravingDescription | null;
  environment: Presentation["environment"];
  background: Presentation["background"];
  camera: CameraSetup;
  lidAngle: number;
  output: Presentation["output"];
}

const layoutCache = new WeakMap<Catalog, Map<string, BoxLayout>>();

export const layoutFor = (catalog: Catalog, productId: string): BoxLayout => {
  let perCatalog = layoutCache.get(catalog);
  if (!perCatalog) {
    perCatalog = new Map();
    layoutCache.set(catalog, perCatalog);
  }
  const cached = perCatalog.get(productId);
  if (cached) return cached;
  const product = catalog.products.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product "${productId}"`);
  const layout = withEngravingArea(
    computeBoxLayout(product.dimensions, catalog.construction),
    { widthCm: product.engraving.widthCm, heightCm: product.engraving.heightCm },
    catalog.personalization.placements.map((p) => p.id),
  );
  perCatalog.set(productId, layout);
  return layout;
};

export const describeScene = (catalog: Catalog, valid: ValidRenderProps): SceneDescription => {
  const { configuration, appearance, view } = valid;
  const presentation = catalog.presentation;
  const layout = layoutFor(catalog, configuration.product);
  const text = configuration.personalization.text;
  const placement = configuration.personalization.placement;
  const anchor = layout.engraving[isEngravingPlacement(placement) ? placement : "lid-inside"];
  const engravingMaterial = anchor.surface === "exterior" ? appearance.exterior : (appearance.pieces[anchor.surface] ?? appearance.interior);

  return {
    productId: configuration.product,
    layout,
    construction: catalog.construction,
    appearance,
    stitch: {
      exterior: appearance.exterior.stitchHex,
      pocket: appearance.pieces.pocket?.stitchHex ?? appearance.interior.stitchHex,
      flap: appearance.pieces.flap?.stitchHex ?? appearance.interior.stitchHex,
    },
    tapeHex: darken(appearance.exterior.hex, presentation.zipTape.darkenExterior),
    hardware: presentation.hardware,
    engraving:
      text.length > 0
        ? { text, anchor, material: engravingMaterial, font: catalog.personalization.font, deboss: catalog.personalization.deboss }
        : null,
    environment: presentation.environment,
    background: presentation.background,
    camera: computeCamera(layout, view, {
      fov: presentation.camera.fov,
      aspect: presentation.output.width / presentation.output.height,
      margin: presentation.camera.framingMargin,
      verticalOffset: presentation.camera.verticalOffset,
    }),
    lidAngle: view.lidAngle,
    output: presentation.output,
  };
};

/**
 * Saves a design in the page URL, so customers can bookmark or share it
 * without an account:
 *
 *   /ontwerp?model=duo&ext=navy&int=beige&pieces=strap.full-grain.cognac&name=A.V.
 *
 * Only pieces that differ from the model's defaults are written. Reading is
 * forgiving: anything unknown or no longer offered (e.g. a colour removed
 * from config/options.ts) falls back to the default instead of failing.
 */
import {
  defaultConfiguration,
  findProduct,
  validateConfiguration,
  type Catalog,
  type Configuration,
  type PieceChoice,
} from "./catalog";

const PIECE_SEPARATOR = ",";
const FIELD_SEPARATOR = ".";

export type DesignState = { configuration: Configuration; name: string };

export function encodeDesign(catalog: Catalog, { configuration, name }: DesignState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("model", configuration.product);
  params.set("ext", configuration.exterior);
  params.set("int", configuration.interior);

  const pieces = catalog.pieces
    .map((piece) => {
      const choice = configuration.pieces[piece.id];
      if (!choice) return null;
      if (choice.material === piece.default.material && choice.color === piece.default.color) return null;
      return [piece.id, choice.material, choice.color].join(FIELD_SEPARATOR);
    })
    .filter((x): x is string => x !== null);
  if (pieces.length > 0) params.set("pieces", pieces.join(PIECE_SEPARATOR));

  const trimmed = name.trim();
  if (trimmed) params.set("name", trimmed);
  return params;
}

export function decodeDesign(catalog: Catalog, params: URLSearchParams): DesignState {
  const model = params.get("model") ?? "";
  const productId = findProduct(catalog, model) ? model : catalog.defaultProduct;
  const base = defaultConfiguration(catalog, productId);

  const pieces: Record<string, PieceChoice> = { ...base.pieces };
  for (const entry of (params.get("pieces") ?? "").split(PIECE_SEPARATOR)) {
    const [id, material, ...color] = entry.split(FIELD_SEPARATOR);
    if (id && material && color.length > 0 && id in pieces) {
      pieces[id] = { material, color: color.join(FIELD_SEPARATOR) };
    }
  }

  const candidate: Configuration = {
    ...base,
    exterior: params.get("ext") ?? base.exterior,
    interior: params.get("int") ?? base.interior,
    pieces,
  };

  // Try the full design, then without custom pieces, then each colour alone.
  const attempts: Configuration[] = [
    candidate,
    { ...candidate, pieces: base.pieces },
    { ...base, exterior: candidate.exterior },
    { ...base, interior: candidate.interior },
  ];
  const configuration = attempts.find((c) => validateConfiguration(catalog, c).ok) ?? base;

  // Length and characters are checked (and explained) by the engraving field.
  const name = (params.get("name") ?? "").slice(0, 60);
  return { configuration, name };
}

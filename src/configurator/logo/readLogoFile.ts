/**
 * Reads a logo the customer uploads, pastes or drops:
 *   check the file (format by content, size) → decode → prepare it (the logo
 *   as uploaded, and, if it has a plain background, versions without it;
 *   prepareLogo.ts) → check the logo is large enough to print → encode each
 *   version as the PNG the preview and the render use.
 * Every failure becomes an Issue with a message for the customer; nothing throws.
 */
import {
  cleanFileName,
  LOGO_SNIFF_BYTES,
  MAX_LOGO_DATA_URL_LENGTH,
  normalisedLogoSize,
  validateLogoDimensions,
  validateLogoFile,
  type Issue,
  type LogoArtwork,
  type LogoFormat,
  type LogoRules,
  type Result,
} from "../catalog";
import { decodeLogoImage, encodeLogoImage, LogoProcessingError, readLogoPixels, WORK_MAX_PX, type DecodedLogo, type LogoProcessingFailure } from "./logoImage";
import { backgroundName, prepareLogo, type LogoImageData, type PrepareLogoFailure } from "./prepareLogo";

export interface ReadLogo {
  /** As uploaded. */
  original: LogoArtwork;
  /** Plain background removed (inside areas in its colour left open); null if there's no plain background. */
  removed: LogoArtwork | null;
  /** Plain background removed, inside areas kept; null if there are none. */
  removedKeepInside: LogoArtwork | null;
  /** Remove the background unless the customer says otherwise (opaque uploads). */
  removeByDefault: boolean;
  /** The background colour, for labels ("white", "black"), when it has a plain name. */
  backgroundName: "white" | "black" | null;
}

/** Decoding a huge or broken file must not leave the customer waiting forever. */
export const LOGO_READ_TIMEOUT_MS = 20_000;

const PATH = "logo.file";

const messages: Record<LogoProcessingFailure | PrepareLogoFailure, (name: string) => string> = {
  read_failed: (name) => `We couldn't read “${name}”. Try uploading it again.`,
  decode_failed: (name) => `“${name}” couldn't be opened as an image. It may be damaged; try exporting it again.`,
  too_detailed: (name) => `“${name}” is too detailed to prepare here. Try a simpler version of the logo, or an SVG.`,
  timeout: (name) => `Reading “${name}” took too long. Try again, or use a smaller file.`,
  empty: (name) => `We couldn't find a logo in “${name}”: the image looks empty. Check that you chose the right file.`,
};

const failed = (failure: LogoProcessingFailure | PrepareLogoFailure, name: string): Result<ReadLogo> => ({
  ok: false,
  issues: [{ path: PATH, code: `logo_${failure}`, message: messages[failure](name) } satisfies Issue],
});

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LogoProcessingError("timeout", "Timed out.")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });

export const readLogoFile = async (file: File, rules: LogoRules): Promise<Result<ReadLogo>> => {
  const name = cleanFileName(file.name);

  let header: Uint8Array;
  try {
    header = new Uint8Array(await file.slice(0, LOGO_SNIFF_BYTES).arrayBuffer());
  } catch {
    return failed("read_failed", name);
  }

  const checked = validateLogoFile({ name, size: file.size, header }, rules, PATH);
  if (!checked.ok) return checked;
  const format = checked.value;

  let decoded: DecodedLogo | null = null;
  try {
    decoded = await withTimeout(decodeLogoImage(file, format), LOGO_READ_TIMEOUT_MS);
    // No size (an SVG without width/height or viewBox): say so before trying to draw it.
    if (!(decoded.width > 0 && decoded.height > 0)) return { ok: false, issues: validateLogoDimensions(decoded, format, rules, name, PATH) };

    // Process at most WORK_MAX_PX; vectors are drawn at that size.
    const longest = Math.max(decoded.width, decoded.height);
    const scale = format === "svg" ? WORK_MAX_PX / longest : Math.min(1, WORK_MAX_PX / longest);
    const w = Math.max(1, Math.round(decoded.width * scale));
    const h = Math.max(1, Math.round(decoded.height * scale));
    const prepared = prepareLogo(readLogoPixels(decoded, w, h), w, h);
    if (!prepared.ok) return failed(prepared.failure, name);
    const { original, removed, removedKeepInside, background, transparent } = prepared.value;
    const removeByDefault = !transparent && removed !== null;

    // The logo itself (not the file's empty space) must be large enough to print.
    const shown = removeByDefault && removed ? removed : original;
    const sizeIssues = validateLogoDimensions({ width: Math.round(shown.width / scale), height: Math.round(shown.height / scale) }, format, rules, name, PATH);
    if (sizeIssues.length > 0) return { ok: false, issues: sizeIssues };

    const encode = (image: LogoImageData, f: LogoFormat): LogoArtwork => {
      const out = normalisedLogoSize(image, f, rules.upload.previewMaxPx);
      return { name, format: f, ...encodeLogoImage(image, out.width, out.height, MAX_LOGO_DATA_URL_LENGTH) };
    };
    return {
      ok: true,
      value: {
        original: encode(original, format),
        removed: removed ? encode(removed, format) : null,
        removedKeepInside: removedKeepInside ? encode(removedKeepInside, format) : null,
        removeByDefault,
        backgroundName: backgroundName(background),
      },
    };
  } catch (e) {
    if (!(e instanceof LogoProcessingError)) console.error("[logo]", e);
    return failed(e instanceof LogoProcessingError ? e.failure : "decode_failed", name);
  } finally {
    decoded?.release();
  }
};

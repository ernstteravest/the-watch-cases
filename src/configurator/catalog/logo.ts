/**
 * Exterior logo rules: upload checks (format by content, file size, pixel
 * size), validation of the logo part of a configuration, and the summary text.
 * Preparing the upload (removing a plain background) happens in
 * src/app/logo/prepareLogo.ts.
 * Pure (no DOM), so the browser, the render server and the tests all apply the
 * same rules.
 */
import type { Catalog, Issue, LogoArtwork, LogoChoice, LogoFormat, LogoRules, Result } from "./schema";

/* ------------------------------------------------------------------ */
/* Names and file-picker filters                                       */
/* ------------------------------------------------------------------ */

const FORMAT_NAMES: Record<LogoFormat, string> = { png: "PNG", jpeg: "JPG", svg: "SVG" };

const ACCEPT: Record<LogoFormat, string[]> = {
  png: [".png", "image/png"],
  jpeg: [".jpg", ".jpeg", "image/jpeg"],
  svg: [".svg", "image/svg+xml"],
};

/** "PNG, JPG or SVG". */
export const logoFormatList = (formats: readonly LogoFormat[]): string => {
  const names = formats.map((f) => FORMAT_NAMES[f]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
};

/** Value for the file input's `accept` attribute. */
export const logoAcceptAttribute = (rules: LogoRules): string => rules.upload.formats.flatMap((f) => ACCEPT[f]).join(",");

/** One line of upload requirements for the customer. */
export const logoUploadHelp = (rules: LogoRules): string =>
  `${logoFormatList(rules.upload.formats)}, up to ${rules.upload.maxFileSizeMb} MB. ` +
  `PNG and JPG logos need at least ${rules.upload.minLongestSidePx} pixels across.`;

/* ------------------------------------------------------------------ */
/* Format detection (by content, not by file name)                     */
/* ------------------------------------------------------------------ */

/** Bytes to read from the start of a file to recognise its format. */
export const LOGO_SNIFF_BYTES = 4096;

export type DetectedFormat = LogoFormat | "gif" | "webp" | "heic" | "avif" | "bmp" | "tiff" | "pdf" | "ico";

const OTHER_FORMAT_NAMES: Record<Exclude<DetectedFormat, LogoFormat>, string> = {
  gif: "a GIF image",
  webp: "a WebP image",
  heic: "a HEIC photo",
  avif: "an AVIF image",
  bmp: "a BMP image",
  tiff: "a TIFF image",
  pdf: "a PDF document",
  ico: "an icon file",
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const hasBytes = (b: Uint8Array, signature: number[], offset = 0) => signature.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

const looksLikeSvg = (header: Uint8Array): boolean => {
  if (header.includes(0)) return false; // binary, or UTF-16 text
  const text = new TextDecoder("utf-8").decode(header).replace(/^\uFEFF/, "");
  const body = text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, "")
    .trimStart();
  return /^<svg[\s>/]/i.test(body);
};

/** Recognises a file's format from its first bytes (see LOGO_SNIFF_BYTES). */
export const detectFileFormat = (header: Uint8Array): DetectedFormat | null => {
  if (hasBytes(header, PNG_SIGNATURE)) return "png";
  if (hasBytes(header, [0xff, 0xd8, 0xff])) return "jpeg";
  if (hasBytes(header, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (hasBytes(header, [0x52, 0x49, 0x46, 0x46]) && hasBytes(header, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (hasBytes(header, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = ascii(header, 8, 12);
    if (["avif", "avis"].includes(brand)) return "avif";
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return "heic";
  }
  if (hasBytes(header, [0x42, 0x4d])) return "bmp";
  if (hasBytes(header, [0x49, 0x49, 0x2a, 0x00]) || hasBytes(header, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  if (hasBytes(header, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (hasBytes(header, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (looksLikeSvg(header)) return "svg";
  return null;
};

/* ------------------------------------------------------------------ */
/* Upload checks                                                       */
/* ------------------------------------------------------------------ */

export interface LogoFileInfo {
  name: string;
  /** Size in bytes. */
  size: number;
  /** The first bytes of the file (up to LOGO_SNIFF_BYTES). */
  header: Uint8Array;
}

const fail = <T>(path: string, code: string, message: string): Result<T> => ({ ok: false, issues: [{ path, code, message }] });

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString("en-GB", { maximumFractionDigits: 1 });

/** File-level checks before the image is decoded: not empty, not too large, a supported format. */
export const validateLogoFile = (file: LogoFileInfo, rules: LogoRules, path = "logo.file"): Result<LogoFormat> => {
  const name = `“${file.name}”`;
  if (file.size === 0) return fail(path, "logo_empty", `${name} is empty. Choose your logo file again.`);
  if (file.size > rules.upload.maxFileSizeMb * 1024 * 1024) {
    return fail(path, "logo_file_too_large", `${name} is ${megabytes(file.size)} MB. Use a file of at most ${rules.upload.maxFileSizeMb} MB.`);
  }
  const format = detectFileFormat(file.header);
  const allowed = logoFormatList(rules.upload.formats);
  if (format === null) {
    return fail(path, "logo_unsupported_format", `${name} isn't a ${allowed} file. Upload your logo in one of those formats.`);
  }
  if (!(rules.upload.formats as readonly string[]).includes(format)) {
    const what = format in OTHER_FORMAT_NAMES ? OTHER_FORMAT_NAMES[format as keyof typeof OTHER_FORMAT_NAMES] : `a ${FORMAT_NAMES[format as LogoFormat]} file`;
    return fail(path, "logo_unsupported_format", `${name} is ${what}. Upload your logo as a ${allowed} file.`);
  }
  return { ok: true, value: format as LogoFormat };
};

/**
 * Checks the logo's size in pixels of the uploaded file (measured after its
 * background is removed): PNG/JPG must be large enough to print sharply; an
 * SVG must declare a size.
 */
export const validateLogoDimensions = (
  size: { width: number; height: number },
  format: LogoFormat,
  rules: LogoRules,
  fileName: string,
  path = "logo.file",
): Issue[] => {
  const name = `“${fileName}”`;
  if (!(size.width > 0 && size.height > 0)) {
    return [
      {
        path,
        code: "logo_no_size",
        message: format === "svg" ? `${name} has no size. Save the SVG with a width and height, or a viewBox.` : `${name} contains no image.`,
      },
    ];
  }
  const min = rules.upload.minLongestSidePx;
  if (format !== "svg" && Math.max(size.width, size.height) < min) {
    return [
      {
        path,
        code: "logo_too_small",
        message: `The logo in ${name} is ${size.width} × ${size.height} pixels, too small to print sharply. Use a larger version (at least ${min} pixels wide or high), or an SVG.`,
      },
    ];
  }
  return [];
};

const CSS_UNITS: Record<string, number> = { "": 1, px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

/**
 * Intrinsic size of an SVG in CSS pixels, from the root element's width/height
 * and viewBox. Null when it has neither (or only percentages without a viewBox).
 */
export const svgIntrinsicSize = (text: string): { width: number; height: number } | null => {
  const attributes = /<svg\b([^>]*)>/i.exec(text)?.[1];
  if (attributes === undefined) return null;
  const attr = (name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(attributes)?.[2];
  const length = (value: string | undefined) => {
    const m = value === undefined ? null : /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value);
    if (!m) return null;
    const n = Number(m[1]) * CSS_UNITS[(m[2] ?? "").toLowerCase()];
    return n > 0 && Number.isFinite(n) ? n : null;
  };
  const width = length(attr("width"));
  const height = length(attr("height"));
  if (width && height) return { width, height };
  const box = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box && box.length === 4 && box[2] > 0 && box[3] > 0) {
    const aspect = box[2] / box[3];
    if (width) return { width, height: width / aspect };
    if (height) return { width: height * aspect, height };
    return { width: box[2], height: box[3] };
  }
  return null;
};

/** Size the uploaded logo is normalised to: longest side at most `maxPx`, never enlarged (except vector art). */
export const normalisedLogoSize = (
  size: { width: number; height: number },
  format: LogoFormat,
  maxPx: number,
): { width: number; height: number } => {
  const longest = Math.max(size.width, size.height);
  const scale = format === "svg" ? maxPx / longest : Math.min(1, maxPx / longest);
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
};

/** Removes characters that don't belong in a file name shown to people. */
export const cleanFileName = (name: string): string =>
  name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255) || "logo";

/* ------------------------------------------------------------------ */
/* The normalised artwork (PNG data URL)                               */
/* ------------------------------------------------------------------ */

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

/** Width and height from a PNG header (signature + IHDR), or null if it isn't a PNG. */
export const readPngSize = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 24 || !hasBytes(bytes, PNG_SIGNATURE) || ascii(bytes, 12, 16) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const decodeBase64Prefix = (base64: string, chars: number): Uint8Array | null => {
  try {
    const binary = atob(base64.slice(0, chars));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/** Checks that artwork carried in a configuration is a well-formed PNG data URL of the declared size. */
export const isValidArtwork = (artwork: LogoArtwork): boolean => {
  if (!artwork.dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return false;
  const payload = artwork.dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (payload.length < 44 || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false;
  const header = decodeBase64Prefix(payload, 44);
  const size = header ? readPngSize(header) : null;
  return size !== null && size.width === artwork.width && size.height === artwork.height;
};

/* ------------------------------------------------------------------ */
/* The logo in a configuration                                         */
/* ------------------------------------------------------------------ */

export interface LogoValidationOptions {
  /** Final render or order: a chosen logo must have been uploaded. */
  requireArtwork?: boolean;
}

/**
 * Validates the logo part of a configuration and returns it in canonical form:
 * `undefined` for no logo, `{ mode, artwork }` for full colour and
 * `{ mode, color, artwork }` for one colour. `artwork: null` (chosen but not
 * uploaded yet) is valid for the preview, not for the final render.
 */
export const validateLogo = (
  input: LogoChoice | undefined,
  rules: LogoRules,
  path = "logo",
  options: LogoValidationOptions = {},
): Result<LogoChoice | undefined> => {
  if (!input) return { ok: true, value: undefined };
  const issues: Issue[] = [];
  const add = (p: string, code: string, message: string) => issues.push({ path: p ? `${path}.${p}` : path, code, message });

  if (!rules.enabled) add("", "logo_disabled", "Logos aren't available.");
  if (!rules.modes.some((m) => m.id === input.mode)) add("mode", "logo_mode_not_offered", `Logo option "${input.mode}" is not offered.`);
  if (input.mode === "one-color") {
    if (!input.color) add("color", "logo_color_required", "Choose a colour for the logo.");
    else if (!rules.colors.some((c) => c.id === input.color)) add("color", "logo_color_not_offered", `"${input.color}" is not a logo colour.`);
  }
  const artwork = input.artwork;
  if (artwork) {
    if (!(rules.upload.formats as readonly string[]).includes(artwork.format)) {
      add("artwork.format", "logo_unsupported_format", `Logo files in ${artwork.format.toUpperCase()} format are not accepted.`);
    }
    if (!isValidArtwork(artwork)) add("artwork", "logo_invalid_artwork", "The logo image is damaged. Upload it again.");
  } else if (options.requireArtwork) {
    add("artwork", "logo_missing", "Upload your logo, or choose No logo.");
  }
  if (issues.length > 0) return { ok: false, issues };
  const copy = artwork ? { ...artwork } : null;
  return { ok: true, value: input.mode === "one-color" ? { mode: input.mode, color: input.color, artwork: copy } : { mode: input.mode, artwork: copy } };
};

/** Summary line: "Logo: full colour, acme.png." / "Logo: one colour, goud, acme.svg." */
export const describeLogo = (catalog: Catalog, logo: LogoChoice | undefined): string | null => {
  if (!logo) return null;
  const parts = [(catalog.logo.modes.find((m) => m.id === logo.mode)?.label ?? logo.mode).toLowerCase()];
  if (logo.mode === "one-color" && logo.color) parts.push(catalog.logo.colors.find((c) => c.id === logo.color)?.label ?? logo.color);
  parts.push(logo.artwork ? logo.artwork.name : "not uploaded yet");
  return `Logo: ${parts.join(", ")}.`;
};

export const EC_LEVELS = ["L", "M", "Q", "H"];
export const SIZES = [256, 512, 1024, 2048, 3072, 4096];
export const MIN_MARGIN = 4;
export const MAX_MARGIN = 20;
export const MAX_VERSION = 40;

export const DEFAULTS = {
  ecLevel: "M",
  version: 0, // 0 = smallest grid that fits
  margin: MIN_MARGIN,
  size: 1024,
  fg: "#000000",
  bg: "#ffffff",
  transparent: false,
};

const COLOUR = /^#[0-9a-f]{6}$/i;

// Form fields deliver strings; storage delivers numbers.
function toNumber(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function normalizeSettings(raw) {
  const s = raw !== null && typeof raw === "object" ? raw : {};
  const version = toNumber(s.version);
  const margin = toNumber(s.margin);
  const size = toNumber(s.size);
  return {
    ecLevel: EC_LEVELS.includes(s.ecLevel) ? s.ecLevel : DEFAULTS.ecLevel,
    version: Number.isInteger(version) && version >= 0 && version <= MAX_VERSION ? version : DEFAULTS.version,
    margin: margin === null ? DEFAULTS.margin : Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Math.round(margin))),
    size: SIZES.includes(size) ? size : DEFAULTS.size,
    fg: typeof s.fg === "string" && COLOUR.test(s.fg) ? s.fg.toLowerCase() : DEFAULTS.fg,
    bg: typeof s.bg === "string" && COLOUR.test(s.bg) ? s.bg.toLowerCase() : DEFAULTS.bg,
    transparent: typeof s.transparent === "boolean" ? s.transparent : DEFAULTS.transparent,
  };
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Scanners need dark modules on a light background with enough contrast.
// A transparent background is assumed to end up on white.
export function hasContrastWarning({ fg, bg, transparent }) {
  const back = transparent ? "#ffffff" : bg;
  return luminance(fg) > luminance(back) || contrastRatio(fg, back) < 3;
}

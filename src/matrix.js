import { qrcode } from "../vendor/qrcode-generator/qrcode.mjs";

export const QUIET_ZONE = 4;

export class CapacityError extends Error {
  constructor(code = "tooLong") {
    super(
      code === "tooLong"
        ? "This URL is too long to fit in a QR code."
        : "This URL is too long for the chosen grid size.",
    );
    this.name = "CapacityError";
    this.code = code;
  }
}

// Byte-mode capacity of version 40 per error correction level.
const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

// version 0 = smallest grid that fits.
export function createMatrix(text, { ecLevel = "M", version = 0 } = {}) {
  // Input must be ASCII: the library truncates chars to 8 bits. Guaranteed by URL.href from normalizeUrl.
  if (text.length > MAX_BYTES[ecLevel]) throw new CapacityError();
  const qr = qrcode(version, ecLevel);
  qr.addData(text);
  try {
    qr.make();
  } catch (e) {
    // The library throws a plain string on overflow, not an Error.
    if (typeof e === "string" && e.startsWith("code length overflow")) {
      throw new CapacityError(version === 0 ? "tooLong" : "tooLongForSize");
    }
    throw e;
  }
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}

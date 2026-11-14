import { qrcode } from "../vendor/qrcode-generator/qrcode.mjs";

export const QUIET_ZONE = 4;

export class CapacityError extends Error {
  constructor() {
    super("This URL is too long to fit in a QR code.");
    this.name = "CapacityError";
  }
}

const MAX_BYTES = 2331; // byte-mode capacity at level M, version 40

export function createMatrix(text) {
  // Input must be ASCII: the library truncates chars to 8 bits. Guaranteed by URL.href from normalizeUrl.
  if (text.length > MAX_BYTES) throw new CapacityError();
  const qr = qrcode(0, "M");
  qr.addData(text);
  try {
    qr.make();
  } catch (e) {
    // The library throws a plain string on overflow, not an Error.
    if (typeof e === "string" && e.startsWith("code length overflow")) {
      throw new CapacityError();
    }
    throw e;
  }
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}

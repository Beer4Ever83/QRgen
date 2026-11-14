export const EMPTY_ERROR = "Please enter a URL.";
export const SCHEME_ERROR = "Only http and https URLs are supported.";
export const INVALID_ERROR = "This doesn't look like a valid URL.";

export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: EMPTY_ERROR };

  // "scheme:" not followed by a digit means the user typed a scheme;
  // "localhost:3000" / "example.com:8080" are host:port.
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: INVALID_ERROR };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: SCHEME_ERROR };
  }
  return { ok: true, url: parsed.href };
}

export function fileBaseName(url) {
  return "qr-" + new URL(url).hostname.replace(/[^a-z0-9.-]/g, "-");
}

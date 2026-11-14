# QRgen — client-side URL to QR code generator

Status: approved
Date: 2026-11-14

## Intent

A single web page with a simple form: the user enters a URL and gets a QR code
they can download, either to show on screens or to print. Everything runs in the
browser; there is no backend.

## Goals

- Encode a URL into a QR code via a form.
- Download as **PNG** (screens) and **SVG** (print, scales without quality loss).
- Extremely lean: no heavy frameworks, no build step.
- All code identifiers, file names and comments in English.

## Non-goals (for now)

- Customisation (colours, logo, error-correction level picker, size picker).
- Encoding anything other than URLs (Wi-Fi, vCard, plain text).
- TypeScript: planned as a later refactor (see Approaches).

## Anti-goals

- The URL must never leave the browser: no network calls at runtime, no
  analytics, no CDN-loaded scripts.
- No backend of any kind.

## Constraints

- Plain HTML + CSS + vanilla JavaScript (ES modules), runnable by serving the
  repo root as static files.
- TDD: tests first, run with Node's built-in runner (`node --test`, Node 24).
- Dev-only dependencies are allowed (they never ship to the page).

## Approaches

- **A. HTML + vanilla JS + vendored QR library — chosen.** Zero build step,
  zero runtime toolchain. Trade-off: no static types; library updates are manual.
- **A1. Same as A but in TypeScript, compiled with `tsc` only.** Considered and
  postponed: adds a build step and a deploy action. Will be done as a later
  refactor.
- **B. Vite + TypeScript + `qrcode` npm package.** Rejected: bundler and
  toolchain go against "extremely lean".
- **Writing our own QR encoder.** Rejected: complex (Reed-Solomon, masking),
  error-prone, no benefit.

## Design

### Modules

- `vendor/` — a small, mature, MIT-licensed QR encoder (candidate:
  `qrcode-generator`), copied into the repo with its licence. It only produces
  the module matrix (which squares are dark).
- `src/url.js` — validates and normalises the input. Pure.
- `src/matrix.js` — wraps the vendored library: URL → boolean matrix. Pure.
- `src/svg.js` — matrix → SVG string. Pure.
- `src/pixels.js` — matrix → RGBA pixel buffer (`width`, `height`, `data`).
  Pure, so it can be tested in Node without a canvas.
- `src/app.js` — DOM glue: reads the form, shows the preview, puts the pixel
  buffer into a `<canvas>` to export the PNG, builds download links. Kept thin.
- `index.html`, `styles.css`.

### Behaviour

1. User types a URL and submits the form.
2. Input is validated; on error, an inline message is shown and nothing is
   generated.
3. On success, a preview is shown together with two buttons:
   "Download PNG" and "Download SVG".

### Testing

- Unit tests for `url.js`, `svg.js`, `pixels.js`.
- Round-trip test: generate the pixel buffer for a URL, decode it with `jsQR`
  (dev dependency), assert the decoded text equals the input.
- End-to-end tests (owner's decision, 2026-11-14): Playwright drives headless
  Chromium, used as a library inside `node --test`. They submit the form,
  download PNG/SVG, decode the PNG with `jsQR`, cover the error cases, and
  assert no requests leave the page's origin. They run in CI too. jsdom was
  rejected because it has no canvas, so the PNG path would go untested.

## Calls made by the builder (please check)

- **Generate on submit**, not live while typing — matches "simple form".
- **Validation:** accept only `http:` / `https:` URLs (checked with the `URL`
  constructor). If the user omits the scheme (`example.com`), prepend
  `https://`.
- **Error-correction level M** (~15% recovery): good balance between density
  and robustness, also for print.
- **Quiet zone of 4 modules** around the code, as the QR spec requires.
- **PNG size:** 1024×1024 px target (integer pixels per module, so edges stay
  sharp). Enough for screens and small prints; SVG covers larger prints.
- **Colours:** black on white.
- **File names:** `qr-<hostname>.png` / `qr-<hostname>.svg`.
- **Too-long input:** if the URL exceeds QR capacity, show an error message.
- **UI language:** English.

## CI/CD (GitHub Actions)

- **CI:** on every push and pull request, run `npm ci`, install Chromium for Playwright, then `node --test` (unit + e2e).
- **Deploy:** on push of a tag matching `v*`, run the tests, then publish to
  GitHub Pages with the official actions (`actions/upload-pages-artifact` +
  `actions/deploy-pages`). The artifact contains only what the page needs
  (`index.html`, `styles.css`, `src/`, `vendor/`) — no tests, docs or
  `package.json`.
- Repo setup (done by the owner, 2026-11-14): repo is public, Pages source is
  "GitHub Actions", and the `github-pages` environment allows deployments from
  branch `main` and tags `v*`.
- Site URL: https://beer4ever83.github.io/QRgen/ — so all asset paths in the
  page must be relative.
- Builder's call: trigger on tag push rather than on the "release published"
  event; to verify that creating a release from the GitHub UI also fires it.

## Open for the plan

- Verify how the vendored library can be imported as an ES module both in the
  browser and in Node (tests).

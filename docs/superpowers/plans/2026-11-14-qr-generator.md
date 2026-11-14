# QRgen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page that turns a URL into a QR code downloadable as PNG and SVG, tested in CI and published to GitHub Pages on `v*` tags.

**Architecture:** Plain HTML/CSS + vanilla ES modules, no build step. Pure modules (`url`, `matrix`, `svg`, `pixels`) hold all logic and are unit-tested with `node --test`; `app.js` is thin DOM glue, covered by end-to-end tests that drive headless Chromium via Playwright (used as a library inside `node --test`). QR encoding is done by the vendored `qrcode-generator` library.

**Tech Stack:** HTML, CSS, JavaScript (ES modules), Node 24 (`node --test`), `qrcode-generator` 2.0.4 (vendored, MIT). Dev only: `jsqr` 1.4.0 (Apache-2.0), `playwright` 1.65.1 (Apache-2.0), `pngjs` 7.0.0 (MIT). GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-14-qr-generator-design.md`

## Global Constraints

- All identifiers, file names, comments and UI copy in English.
- No runtime network calls, no analytics, no CDN scripts: the URL never leaves the browser.
- No build step: the published files are the source files.
- All asset paths in the page are relative (site lives at `https://beer4ever83.github.io/QRgen/`).
- Error-correction level `M`; quiet zone 4 modules; black on white.
- PNG target size 1024 px with an integer number of pixels per module.
- Only `devDependencies` in `package.json`; `"type": "module"`, `"private": true`.
- Commits: no AI attribution of any kind (no `Co-Authored-By`, no "Generated with").
- Facts measured on 2026-11-14 and relied on below:
  - `qrcode-generator/dist/qrcode.mjs` exports `qrcode(typeNumber, level)` (named + default). `typeNumber 0` = auto.
  - On overflow, `make()` throws a **string** (`"code length overflow. (…)"`), not an `Error`.
  - Max byte-mode payload at level M: **2331** bytes (version 40, 177 modules).
  - Default `stringToBytes` truncates each char to 8 bits. Safe for us because `new URL(...).href` is always ASCII (IDN → punycode, path/query/fragment percent-encoded), e.g. `https://ü.com/ä?q=é#ß` → `https://xn--tda.com/%C3%A4?q=%C3%A9#%C3%9F`.
  - Latest action majors: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`.

## Review Focus

1. **Non-ASCII URLs** (IDN host, accented path): must encode the normalised ASCII `href` and decode back to it — test in Task 3.
2. **URL too long for a QR code**: friendly message, never an uncaught string throw — tests in Task 2 (boundary 2331/2332).
3. **Non-web schemes and scheme-less input with a port** (`javascript:`, `mailto:`, `ftp:` rejected; `localhost:3000` accepted as https) — tests in Task 1.
4. **Empty / whitespace-only / padded input** — tests in Task 1.
5. **Submitting again** (new URL, or an invalid one after a valid one): the old preview and links must be replaced or hidden — e2e tests in Task 5.

---

### Task 1: Project scaffold + URL normalisation

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`)
- Create: `src/url.js`
- Test: `test/url.test.js`

**Interfaces:**
- Produces:
  - `normalizeUrl(input: string): { ok: true, url: string } | { ok: false, error: string }`
  - `fileBaseName(url: string): string`
  - Error copy (exported constants in `src/url.js`):
    - `EMPTY_ERROR = "Please enter a URL."`
    - `SCHEME_ERROR = "Only http and https URLs are supported."`
    - `INVALID_ERROR = "This doesn't look like a valid URL."`

- [ ] **Step 1: Commit spec and plan**

```bash
git add docs/
git commit -m "docs: add QR generator design and implementation plan"
```

- [ ] **Step 2: Create `package.json`**

`name: "qrgen"`, `private: true`, `type: "module"`, `engines.node: ">=24"`, `scripts.test: "node --test"`, `devDependencies.jsqr: "1.4.0"` (exact). Run `npm install` to create `package-lock.json`.

- [ ] **Step 3: Write the failing tests in `test/url.test.js`**

`normalizeUrl` cases (input → expected):

| input | expected |
|---|---|
| `"https://example.com"` | ok, `"https://example.com/"` |
| `"  https://example.com  "` | ok, `"https://example.com/"` |
| `"HTTPS://Example.COM"` | ok, `"https://example.com/"` |
| `"http://example.com/a?b=1#c"` | ok, `"http://example.com/a?b=1#c"` |
| `"example.com"` | ok, `"https://example.com/"` |
| `"localhost:3000/x"` | ok, `"https://localhost:3000/x"` |
| `"example.com:8080"` | ok, `"https://example.com:8080/"` |
| `"https://ü.com/ä"` | ok, `"https://xn--tda.com/%C3%A4"` |
| `""`, `"   "` | error `EMPTY_ERROR` |
| `"javascript:alert(1)"`, `"mailto:a@b.com"`, `"ftp://example.com"` | error `SCHEME_ERROR` |
| `"hello world"`, `"https://"` | error `INVALID_ERROR` |

`fileBaseName` cases: `"https://example.com/"` → `"qr-example.com"`; `"https://xn--tda.com/"` → `"qr-xn--tda.com"`; `"http://[::1]:8080/"` → `"qr----1-"`.

- [ ] **Step 4: Run `npm test`** — expected: FAIL (module `src/url.js` not found).

- [ ] **Step 5: Implement `src/url.js`**

Algorithm for `normalizeUrl` (the scheme rule is not determined by the tests alone):

```js
const trimmed = input.trim();
// empty → EMPTY_ERROR
// A leading "scheme:" NOT followed by a digit means the user typed a scheme;
// "localhost:3000" / "example.com:8080" are host:port, so we prepend https://.
const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed);
const candidate = hasScheme ? trimmed : `https://${trimmed}`;
// new URL(candidate) throws → INVALID_ERROR
// protocol not http:/https: → SCHEME_ERROR
// otherwise → { ok: true, url: parsed.href }
```

`fileBaseName`: `"qr-" + new URL(url).hostname` with every char outside `[a-z0-9.-]` replaced by `-`.

- [ ] **Step 6: Run `npm test`** — expected: all `url` tests PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore src/url.js test/url.test.js
git commit -m "feat: add URL normalisation"
```

---

### Task 2: Vendored encoder + matrix

**Files:**
- Create: `vendor/qrcode-generator/qrcode.mjs` (unmodified copy of `dist/qrcode.mjs` from `qrcode-generator@2.0.4`)
- Create: `vendor/README.md` (source package, version, licence MIT © Kazuhiko Arase, how to update: `npm pack qrcode-generator@<version>` in an empty temp dir and copy `dist/qrcode.mjs`)
- Create: `src/matrix.js`
- Test: `test/matrix.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `QUIET_ZONE = 4` (exported constant)
  - `class CapacityError extends Error` with message `"This URL is too long to fit in a QR code."`
  - `createMatrix(text: string): boolean[][]` — square, `matrix[row][col]`, `true` = dark; level `M`, auto version. Throws `CapacityError` on overflow; any other throw is rethrown.

- [ ] **Step 1: Vendor the library**

In a new empty temp dir: `npm pack qrcode-generator@2.0.4`, extract, copy `package/dist/qrcode.mjs` to `vendor/qrcode-generator/qrcode.mjs`. Confirm the MIT header is intact. Write `vendor/README.md`.

- [ ] **Step 2: Write the failing tests in `test/matrix.test.js`**

- `createMatrix("https://example.com/")` has length 25 and every row has length 25.
- Top-left finder pattern: `m[0][0]`, `m[0][6]`, `m[6][0]`, `m[6][6]` are `true`; `m[1][1]` is `false`; `m[3][3]` is `true`.
- `createMatrix("a".repeat(2331))` does not throw and has length 177.
- `createMatrix("a".repeat(2332))` throws `CapacityError` (`assert.throws(..., CapacityError)`), and the error is `instanceof Error`.

- [ ] **Step 3: Run `npm test`** — expected: FAIL (module `src/matrix.js` not found).

- [ ] **Step 4: Implement `src/matrix.js`**

Import `{ qrcode }` from `../vendor/qrcode-generator/qrcode.mjs`. Overflow detection: catch the thrown value, and if it is a string starting with `"code length overflow"`, throw `CapacityError`.

- [ ] **Step 5: Run `npm test`** — expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add vendor/ src/matrix.js test/matrix.test.js
git commit -m "feat: add QR matrix generation with vendored qrcode-generator"
```

---

### Task 3: PNG pixel buffer + decode round-trip

**Files:**
- Create: `src/pixels.js`
- Test: `test/pixels.test.js`

**Interfaces:**
- Consumes: `createMatrix`, `QUIET_ZONE` (Task 2); `normalizeUrl` (Task 1, tests only).
- Produces: `toPixels(matrix: boolean[][], targetSize = 1024): { width: number, height: number, data: Uint8ClampedArray }` — RGBA, row-major; dark = `0,0,0,255`, light = `255,255,255,255`; `scale = Math.max(1, Math.floor(targetSize / (n + 2 * QUIET_ZONE)))`, `width = height = (n + 2 * QUIET_ZONE) * scale`.

- [ ] **Step 1: Write the failing tests in `test/pixels.test.js`**

- For `createMatrix("https://example.com/")` (n = 25): `width === height === 1023` (scale 31), `data.length === 1023 * 1023 * 4`.
- Pixel `(0, 0)` is white (quiet zone); pixel `(4 * 31, 4 * 31)` is black (finder pattern).
- `toPixels(createMatrix("a".repeat(2331)))` has `width === 925` (n = 177, scale 5) — never exceeds 1024.
- Round-trip with `jsQR(data, width, height)` (`import jsQR from "jsqr"`) decodes to the input, for:
  - `"https://example.com/"`
  - `normalizeUrl("https://ü.com/ä?q=é#ß").url` (expect `"https://xn--tda.com/%C3%A4?q=%C3%A9#%C3%9F"`)
  - a 1000-char URL `"https://example.com/" + "a".repeat(980)`

- [ ] **Step 2: Run `npm test`** — expected: FAIL (module `src/pixels.js` not found).

- [ ] **Step 3: Implement `src/pixels.js`**

- [ ] **Step 4: Run `npm test`** — expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pixels.js test/pixels.test.js
git commit -m "feat: render QR matrix to RGBA pixel buffer"
```

- [ ] **Step 6: Star the library repo (the owner asked for it once the library is proven to work)**

Only if the round-trip tests above pass:

```bash
gh api -X PUT user/starred/kazuhikoarase/qrcode-generator
gh api user/starred/kazuhikoarase/qrcode-generator  # expect HTTP 204, no error
```

---

### Task 4: SVG export

**Files:**
- Create: `src/svg.js`
- Test: `test/svg.test.js`

**Interfaces:**
- Consumes: `createMatrix`, `QUIET_ZONE` (Task 2).
- Produces: `toSvg(matrix: boolean[][]): string` — standalone SVG document:
  - root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 N N" shape-rendering="crispEdges">` with `N = n + 2 * QUIET_ZONE`, no `width`/`height` (scales to its container);
  - a white full-size `<rect>` background (`fill="#fff"`);
  - one `<path fill="#000" d="…">` where each dark module at `(row, col)` contributes `M{col + QUIET_ZONE},{row + QUIET_ZONE}h1v1h-1z`.

- [ ] **Step 1: Write the failing tests in `test/svg.test.js`**

- For `createMatrix("https://example.com/")`: output starts with `<svg`, contains `xmlns="http://www.w3.org/2000/svg"` and `viewBox="0 0 33 33"`.
- Parsing all `M(\d+),(\d+)` pairs out of the path `d` gives exactly the set of dark modules, offset by 4 (compare as sets of `"x,y"` strings against the matrix).
- No `width=` / `height=` attribute on the root element.

- [ ] **Step 2: Run `npm test`** — expected: FAIL (module `src/svg.js` not found).

- [ ] **Step 3: Implement `src/svg.js`**

- [ ] **Step 4: Run `npm test`** — expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/svg.js test/svg.test.js
git commit -m "feat: export QR matrix as SVG"
```

---

### Task 5: Page UI + end-to-end tests

**Files:**
- Create: `scripts/serve.js` (dev-only static server, no dependencies)
- Create: `index.html`, `styles.css`, `src/app.js`
- Test: `test/e2e/page.test.js`
- Modify: `package.json` (dev deps `playwright: "1.65.1"`, `pngjs: "7.0.0"`, exact; script `start: "node scripts/serve.js"`)
- Modify: `README.md` (what it is, how to run locally with `npm start`, how to test incl. `npx playwright install chromium`, how to release)

**Interfaces:**
- Consumes: `normalizeUrl`, `fileBaseName` (Task 1); `createMatrix`, `CapacityError` (Task 2); `toPixels` (Task 3); `toSvg` (Task 4).
- Produces: `startServer(port = 0): Promise<{ url: string, close: () => Promise<void> }>` in `scripts/serve.js` — serves the repo root over `node:http` on `127.0.0.1`; `url` ends with `/`. MIME types at least for `.html`, `.css`, `.js`, `.mjs` (`text/javascript` — browsers refuse modules otherwise), `.svg`. Requests resolving outside the repo root → 404. When run directly (`node scripts/serve.js`), listens on port 8000 and prints the URL.

Page structure (`index.html`, all paths relative, `<script type="module" src="src/app.js">`):
- `<form id="qr-form" novalidate>` with `<label for="url-input">URL</label>`, `<input id="url-input" type="text" inputmode="url" autocomplete="url" placeholder="https://example.com" autofocus>` (`type="text"`, not `"url"`: native URL validation would reject `example.com`), `<button type="submit">Generate</button>`.
- `<p id="error" role="alert" hidden>`.
- `<section id="result" hidden>` with `<img id="preview" alt="">`, `<p id="encoded-url">` (shows the normalised URL actually encoded, since we may add `https://`), `<a id="download-png" download>Download PNG</a>`, `<a id="download-svg" download>Download SVG</a>`.

`app.js` behaviour on submit (`preventDefault`):
1. `normalizeUrl`; on error → show message in `#error`, hide `#result`, stop.
2. `createMatrix`; on `CapacityError` → same as above with its message.
3. Revoke the previous object URLs.
4. SVG: `Blob([toSvg(m)], { type: "image/svg+xml" })` → object URL → `#preview.src` and `#download-svg.href`.
5. PNG: `toPixels(m)` → `<canvas>` of that size → `putImageData(new ImageData(data, width, height), 0, 0)` → `canvas.toBlob(..., "image/png")` → object URL → `#download-png.href`.
6. `download` attributes = `fileBaseName(url) + ".png"` / `".svg"`; `#preview.alt = "QR code for " + url` (set via property, never `innerHTML`); `#encoded-url.textContent = url`; hide `#error`, show `#result`.

Styling: minimal, centred single column, system font, preview shown at ~256 px with `image-rendering: pixelated` not needed (SVG). Works on mobile widths.

- [ ] **Step 1: Add dev dependencies and the server**

`npm install -D -E playwright@1.65.1 pngjs@7.0.0`, then `npx playwright install chromium`. Write `scripts/serve.js`.

- [ ] **Step 2: Write the failing e2e tests in `test/e2e/page.test.js`**

Setup: `before` starts `startServer()` and `chromium.launch()`; each test uses a fresh `browser.newContext({ acceptDownloads: true })` page; `after` closes both. Every test records `page.on("request")` URLs and, at the end, asserts each starts with the server `url`, `blob:` or `data:` (no external requests). Helper `submit(page, text)` fills `#url-input` and clicks the submit button.

- `example.com` → `#result` visible, `#error` hidden, `#encoded-url` text `"https://example.com/"`, `#preview` has `naturalWidth > 0` and alt `"QR code for https://example.com/"`.
- PNG download: click `#download-png` with `page.waitForEvent("download")` → `suggestedFilename() === "qr-example.com.png"`; read the file with `PNG.sync.read` (pngjs) → `width === height === 1023`; `jsQR(data, width, height).data === "https://example.com/"`.
- SVG download: `suggestedFilename() === "qr-example.com.svg"`; file content starts with `<svg` and contains `viewBox="0 0 33 33"`.
- `javascript:alert(1)` after a valid submit → `#error` visible with `"Only http and https URLs are supported."`, `#result` hidden.
- Empty submit → `#error` text `"Please enter a URL."`.
- `"https://example.com/" + "a".repeat(3000)` → `#error` text `"This URL is too long to fit in a QR code."`.
- `https://a.example/` then `https://b.example/` → downloaded PNG decodes to `"https://b.example/"`, PNG filename `"qr-b.example.png"`.

- [ ] **Step 3: Run `npm test`** — expected: unit tests PASS, e2e tests FAIL (page/elements missing).

- [ ] **Step 4: Write `index.html`, `styles.css`, `src/app.js`**

- [ ] **Step 5: Run `npm test`** — expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/serve.js index.html styles.css src/app.js test/e2e/ README.md
git commit -m "feat: add QR generator page with end-to-end tests"
```

---

### Task 6: CI and Pages deploy

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**`ci.yml`:** `on: push` (branches `"**"` only, so tag pushes don't run it twice) and `pull_request`. One job on `ubuntu-latest`: `actions/checkout@v7`, `actions/setup-node@v7` (`node-version: 24`, `cache: npm`), `npm ci`, `npx playwright install --with-deps chromium`, `npm test`.

**`deploy.yml`:** `on: push: tags: ["v*"]`. `permissions: { contents: read, pages: write, id-token: write }`. `concurrency: { group: pages, cancel-in-progress: false }`.
- Job `test`: same steps as CI.
- Job `deploy` (`needs: test`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`): checkout; assemble `_site/` by copying only `index.html`, `styles.css`, `src/`, `vendor/`; `actions/upload-pages-artifact@v5` with `path: _site`; `actions/deploy-pages@v5` with `id: deployment`.

- [ ] **Step 1: Write both workflow files**

- [ ] **Step 2: Validate syntax locally**

Run: `npx --yes action-validator .github/workflows/ci.yml .github/workflows/deploy.yml` (or `actionlint` if installed). Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: run tests on push and deploy to Pages on version tags"
```

- [ ] **Step 4: Hand back to the owner**

Pushing the branch, opening the PR and tagging the first release are outward-facing: ask the owner first. After the first `v*` tag, verify: deploy run is green, `https://beer4ever83.github.io/QRgen/` serves the page. Also note whether creating a release from the GitHub UI triggered the tag workflow (open question in the spec).

import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { startServer } from "../../scripts/serve.js";
import { HTML_LANG, t } from "../../src/i18n.js";

let server;
let browser;
let context;
let page;
let requests;

before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  context = await browser.newContext({ acceptDownloads: true });
  page = await context.newPage();
  requests = [];
  page.on("request", (req) => requests.push(req.url()));
  await page.goto(server.url);
});

afterEach(async () => {
  await context.close();
  for (const url of requests) {
    assert.ok(
      url.startsWith(server.url) || url.startsWith("blob:") || url.startsWith("data:"),
      `unexpected external request: ${url}`,
    );
  }
});

async function submit(text) {
  await page.fill("#url-input", text);
  await page.click("button[type=submit]");
}

async function download(selector) {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.click(selector),
  ]);
  return { name: dl.suggestedFilename(), path: await dl.path() };
}

async function decodePng(path) {
  const { width, height, data } = PNG.sync.read(await readFile(path));
  const code = jsQR(new Uint8ClampedArray(data), width, height);
  return { width, height, text: code?.data };
}

test("shows the result for a URL without a scheme", async () => {
  await submit("example.com");
  await page.locator("#result").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").isHidden(), true);
  assert.equal(await page.locator("#encoded-url").textContent(), "https://example.com/");
  const preview = page.locator("#preview");
  assert.equal(await preview.getAttribute("alt"), t("it", "alt", { url: "https://example.com/" }));
  assert.ok((await preview.getAttribute("src")).startsWith("blob:"));
  await preview.evaluate((img) => img.decode());
});

test("downloads a decodable PNG", async () => {
  await submit("example.com");
  const { name, path } = await download("#download-png");
  assert.equal(name, "qr-example.com.png");
  const { width, height, text } = await decodePng(path);
  assert.equal(width, 1023);
  assert.equal(height, 1023);
  assert.equal(text, "https://example.com/");
});

test("downloads an SVG", async () => {
  await submit("example.com");
  const { name, path } = await download("#download-svg");
  assert.equal(name, "qr-example.com.svg");
  const svg = await readFile(path, "utf8");
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('viewBox="0 0 33 33"'));
});

test("rejects non-http schemes and hides the previous result", async () => {
  await submit("example.com");
  await page.locator("#result").waitFor({ state: "visible" });
  await submit("javascript:alert(1)");
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").textContent(), t("it", "scheme"));
  assert.equal(await page.locator("#result").isHidden(), true);
});

test("rejects empty input", async () => {
  await submit("");
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").textContent(), t("it", "empty"));
});

test("rejects URLs that are too long", async () => {
  await submit("https://example.com/" + "a".repeat(3000));
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#error").textContent(),
    t("it", "tooLong"),
  );
});

test("a second submit replaces the first result", async () => {
  await submit("https://a.example/");
  await page.locator("#encoded-url", { hasText: "https://a.example/" }).waitFor();
  await submit("https://b.example/");
  await page.locator("#encoded-url", { hasText: "https://b.example/" }).waitFor();
  const { name, path } = await download("#download-png");
  assert.equal(name, "qr-b.example.png");
  assert.equal((await decodePng(path)).text, "https://b.example/");
});

test("an invalid submit right after a valid one is not overwritten by the pending result", async () => {
  await page.evaluate(() => {
    const input = document.querySelector("#url-input");
    const form = document.querySelector("#qr-form");
    input.value = "https://a.example/";
    form.requestSubmit();
    input.value = "javascript:alert(1)";
    form.requestSubmit();
  });
  await page.locator("#error").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#error").isVisible(), true);
  assert.equal(await page.locator("#result").isHidden(), true);
});

test("the page triggers no CSP violations", async () => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await page.reload();
  await submit("example.com");
  await page.locator("#result").waitFor({ state: "visible" });
  await page.locator("#preview").evaluate((img) => img.decode());
  await download("#download-png");
  await download("#download-svg");
  assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
});

async function copy(p = page) {
  return {
    lang: await p.locator("html").getAttribute("lang"),
    label: await p.locator("label[for=url-input]").textContent(),
    generate: await p.locator("button[type=submit]").textContent(),
    png: await p.locator("#download-png").textContent(),
    svg: await p.locator("#download-svg").textContent(),
    nav: await p.locator("nav.languages").getAttribute("aria-label"),
    pressed: await p.locator("nav.languages button[aria-pressed=true]").getAttribute("data-lang"),
  };
}

function expectedCopy(lang) {
  return {
    lang: HTML_LANG[lang],
    label: t(lang, "label"),
    generate: t(lang, "generate"),
    png: t(lang, "downloadPng"),
    svg: t(lang, "downloadSvg"),
    nav: t(lang, "language"),
    pressed: lang,
  };
}

test("the page is in Italian by default", async () => {
  assert.deepEqual(await copy(), expectedCopy("it"));
});

test("the page is in Italian before any script runs", async () => {
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const p = await noJs.newPage();
  await p.goto(server.url);
  assert.deepEqual(await copy(p), expectedCopy("it"));
  await noJs.close();
});

test("switching to English and Spanish translates the page", async () => {
  for (const lang of ["en", "es", "it"]) {
    await page.click(`nav.languages button[data-lang=${lang}]`);
    assert.deepEqual(await copy(), expectedCopy(lang));
  }
});

test("switching language translates the error on screen", async () => {
  await submit("");
  await page.locator("#error").waitFor({ state: "visible" });
  await page.click("nav.languages button[data-lang=es]");
  assert.equal(await page.locator("#error").textContent(), t("es", "empty"));
  await page.click("nav.languages button[data-lang=en]");
  assert.equal(await page.locator("#error").textContent(), t("en", "empty"));
});

test("switching language translates the result without regenerating it", async () => {
  await submit("example.com");
  await page.locator("#result").waitFor({ state: "visible" });
  const src = await page.locator("#preview").getAttribute("src");
  await page.click("nav.languages button[data-lang=en]");
  assert.equal(await page.locator("#preview").getAttribute("alt"), t("en", "alt", { url: "https://example.com/" }));
  assert.equal(await page.locator("#preview").getAttribute("src"), src);
});

test("an error raised after switching is in the new language", async () => {
  await page.click("nav.languages button[data-lang=es]");
  await submit("javascript:alert(1)");
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").textContent(), t("es", "scheme"));
});

test("the chosen language survives a reload", async () => {
  await page.click("nav.languages button[data-lang=es]");
  await page.reload();
  assert.deepEqual(await copy(), expectedCopy("es"));
});

test("an unknown stored language falls back to Italian", async () => {
  await page.evaluate(() => localStorage.setItem("qrgen.lang", "fr"));
  await page.reload();
  assert.deepEqual(await copy(), expectedCopy("it"));
});

test("the page works when storage is unavailable", async () => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await page.reload();
  assert.deepEqual(await copy(), expectedCopy("it"));
  await page.click("nav.languages button[data-lang=en]");
  assert.deepEqual(await copy(), expectedCopy("en"));
});

async function openAdvanced() {
  await page.click("#advanced summary");
}

async function waitForNewPreview(oldSrc) {
  await page.waitForFunction(
    (src) => {
      const img = document.querySelector("#preview");
      return !document.querySelector("#result").hidden && img.src !== src;
    },
    oldSrc,
  );
}

async function generated(text) {
  await submit(text);
  await page.locator("#result").waitFor({ state: "visible" });
  return page.locator("#preview").getAttribute("src");
}

async function fieldValues() {
  return page.evaluate(() => ({
    ecLevel: document.querySelector("#ec-level").value,
    version: document.querySelector("#version").value,
    margin: document.querySelector("#margin").value,
    size: document.querySelector("#size").value,
    fg: document.querySelector("#fg").value,
    bg: document.querySelector("#bg").value,
    transparent: document.querySelector("#transparent").checked,
  }));
}

const DEFAULT_FIELDS = {
  ecLevel: "M", version: "0", margin: "4", size: "1024", fg: "#000000", bg: "#ffffff", transparent: false,
};

test("advanced settings are closed by default and show the defaults", async () => {
  assert.equal(await page.locator("#advanced").evaluate((d) => d.open), false);
  assert.equal(await page.locator("#ec-level").isVisible(), false);
  assert.deepEqual(await fieldValues(), DEFAULT_FIELDS);
  assert.equal(await page.locator("#version option").count(), 41);
  assert.equal(await page.locator("#size option").count(), 6);
});

test("changing a setting regenerates the QR code shown", async () => {
  const src = await generated("example.com");
  await openAdvanced();
  await page.selectOption("#ec-level", "H");
  await waitForNewPreview(src);
  const { path } = await download("#download-png");
  const png = await decodePng(path);
  assert.equal(png.text, "https://example.com/");
  assert.equal(png.width, 999); // version 3 at level H: 37 modules x 27 px
});

test("a setting change regenerates the last generated URL, not unsubmitted input", async () => {
  const src = await generated("https://a.example/");
  await page.fill("#url-input", "https://b.example/");
  await openAdvanced();
  await page.selectOption("#size", "2048");
  await waitForNewPreview(src);
  const { name, path } = await download("#download-png");
  assert.equal(name, "qr-a.example.png");
  const png = await decodePng(path);
  assert.equal(png.text, "https://a.example/");
  assert.equal(png.width, 2046);
});

test("colours, margin and transparency reach the downloads", async () => {
  await openAdvanced();
  await page.locator("#fg").fill("#274472");
  await page.locator("#bg").fill("#d5e0f2");
  await page.fill("#margin", "10");
  await page.locator("#margin").dispatchEvent("change");
  await generated("example.com");
  const svg = await readFile((await download("#download-svg")).path, "utf8");
  assert.ok(svg.includes('viewBox="0 0 45 45"'));
  assert.ok(svg.includes('fill="#274472"'));
  assert.ok(svg.includes('fill="#d5e0f2"'));
  assert.equal((await decodePng((await download("#download-png")).path)).text, "https://example.com/");
  const src = await page.locator("#preview").getAttribute("src");
  await page.check("#transparent");
  assert.equal(await page.locator("#bg").isDisabled(), true);
  await waitForNewPreview(src);
  const clear = await readFile((await download("#download-svg")).path, "utf8");
  assert.ok(!clear.includes("<rect"));
});

test("the margin cannot go below 4 or above 20", async () => {
  await openAdvanced();
  await page.fill("#margin", "1");
  await page.locator("#margin").dispatchEvent("change");
  assert.equal(await page.inputValue("#margin"), "4");
  await page.fill("#margin", "50");
  await page.locator("#margin").dispatchEvent("change");
  assert.equal(await page.inputValue("#margin"), "20");
});

test("settings survive a reload and reset restores the defaults", async () => {
  await openAdvanced();
  await page.selectOption("#ec-level", "Q");
  await page.selectOption("#version", "10");
  await page.selectOption("#size", "4096");
  await page.reload();
  const kept = await fieldValues();
  assert.equal(kept.ecLevel, "Q");
  assert.equal(kept.version, "10");
  assert.equal(kept.size, "4096");
  await openAdvanced();
  await page.click("#reset");
  assert.deepEqual(await fieldValues(), DEFAULT_FIELDS);
  await page.reload();
  assert.deepEqual(await fieldValues(), DEFAULT_FIELDS);
});

test("garbage in stored settings falls back to the defaults", async () => {
  await page.evaluate(() => localStorage.setItem("qrgen.settings", "{"));
  await page.reload();
  assert.deepEqual(await fieldValues(), DEFAULT_FIELDS);
  await page.evaluate(() =>
    localStorage.setItem("qrgen.settings", JSON.stringify({ ecLevel: "H", margin: 99, fg: "red" })),
  );
  await page.reload();
  assert.deepEqual(await fieldValues(), { ...DEFAULT_FIELDS, ecLevel: "H", margin: "20" });
});

test("low-contrast colours show a warning", async () => {
  await openAdvanced();
  const warning = page.locator("#contrast-warning");
  assert.equal(await warning.isVisible(), false);
  await page.locator("#fg").fill("#777777");
  await page.locator("#bg").fill("#888888");
  await warning.waitFor({ state: "visible" });
  assert.equal(await warning.textContent(), t("it", "contrastWarning"));
  await page.click("#reset");
  await warning.waitFor({ state: "hidden" });
});

test("a grid too small for the URL shows an error, and a bigger one fixes it", async () => {
  await openAdvanced();
  await page.selectOption("#version", "1");
  await submit("https://example.com/" + "a".repeat(100));
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").textContent(), t("it", "tooLongForSize"));
  await page.selectOption("#version", "0");
  await page.locator("#result").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").isHidden(), true);
});

test("switching language translates the advanced settings", async () => {
  await page.click("nav.languages button[data-lang=es]");
  assert.equal(await page.locator("#advanced summary").textContent(), t("es", "advanced"));
  assert.equal(await page.locator("label[for=ec-level]").textContent(), t("es", "ecLevel"));
  assert.equal(await page.locator("#ec-level option[value=H]").textContent(), t("es", "ecH"));
  assert.equal(await page.locator("#version option[value='0']").textContent(), t("es", "versionAuto"));
  assert.equal(await page.locator("#size option[value='1024']").textContent(), t("es", "sizeOption", { px: "1024" }));
  assert.equal(await page.locator("#reset").textContent(), t("es", "reset"));
});

test("every static text is Italian before any script runs", async () => {
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const p = await noJs.newPage();
  await p.goto(server.url);
  const texts = await p.$$eval("[data-i18n]", (els) =>
    els.map((el) => ({ key: el.dataset.i18n, params: { ...el.dataset }, text: el.textContent })),
  );
  assert.ok(texts.length > 15);
  for (const { key, params, text } of texts) assert.equal(text, t("it", key, params), key);
  await noJs.close();
});

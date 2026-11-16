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

import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { startServer } from "../../scripts/serve.js";

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
  assert.equal(await preview.getAttribute("alt"), "QR code for https://example.com/");
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
  assert.equal(await page.locator("#error").textContent(), "Only http and https URLs are supported.");
  assert.equal(await page.locator("#result").isHidden(), true);
});

test("rejects empty input", async () => {
  await submit("");
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#error").textContent(), "Please enter a URL.");
});

test("rejects URLs that are too long", async () => {
  await submit("https://example.com/" + "a".repeat(3000));
  await page.locator("#error").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#error").textContent(),
    "This URL is too long to fit in a QR code.",
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

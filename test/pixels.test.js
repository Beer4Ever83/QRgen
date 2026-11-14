import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { createMatrix } from "../src/matrix.js";
import { normalizeUrl } from "../src/url.js";
import { toPixels } from "../src/pixels.js";

function pixelAt({ width, data }, x, y) {
  const i = (y * width + x) * 4;
  return Array.from(data.slice(i, i + 4));
}

test("a 25-module matrix is rendered at 31 px per module (1023 px)", () => {
  const img = toPixels(createMatrix("https://example.com/"));
  assert.equal(img.width, 1023);
  assert.equal(img.height, 1023);
  assert.equal(img.data.length, 1023 * 1023 * 4);
});

test("the quiet zone is white and the finder pattern is black", () => {
  const img = toPixels(createMatrix("https://example.com/"));
  assert.deepEqual(pixelAt(img, 0, 0), [255, 255, 255, 255]);
  assert.deepEqual(pixelAt(img, 4 * 31, 4 * 31), [0, 0, 0, 255]);
});

test("the largest matrix never exceeds the 1024 px target", () => {
  const img = toPixels(createMatrix("a".repeat(2331)));
  assert.equal(img.width, 925);
  assert.equal(img.height, 925);
});

const roundTrips = [
  ["a short URL", "https://example.com/", "https://example.com/"],
  [
    "an internationalised URL",
    normalizeUrl("https://ü.com/ä?q=é#ß").url,
    "https://xn--tda.com/%C3%A4?q=%C3%A9#%C3%9F",
  ],
  [
    "a 1000-character URL",
    "https://example.com/" + "a".repeat(980),
    "https://example.com/" + "a".repeat(980),
  ],
];

for (const [name, text, expected] of roundTrips) {
  test(`round-trip decodes ${name}`, () => {
    assert.equal(text, expected);
    const { data, width, height } = toPixels(createMatrix(text));
    const result = jsQR(data, width, height);
    assert.ok(result, "jsQR found no QR code");
    assert.equal(result.data, expected);
  });
}

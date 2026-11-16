import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  EC_LEVELS,
  SIZES,
  MIN_MARGIN,
  MAX_MARGIN,
  normalizeSettings,
  contrastRatio,
  hasContrastWarning,
} from "../src/settings.js";

test("defaults reproduce today's output", () => {
  assert.deepEqual(DEFAULTS, {
    ecLevel: "M", version: 0, margin: 4, size: 1024, fg: "#000000", bg: "#ffffff", transparent: false,
  });
  assert.deepEqual(EC_LEVELS, ["L", "M", "Q", "H"]);
  assert.deepEqual(SIZES, [256, 512, 1024, 2048, 3072, 4096]);
  assert.equal(MIN_MARGIN, 4);
  assert.equal(MAX_MARGIN, 20);
});

for (const raw of [undefined, null, "{", 42, [], {}]) {
  test(`normalizeSettings(${JSON.stringify(raw)}) is the defaults`, () => {
    assert.deepEqual(normalizeSettings(raw), DEFAULTS);
  });
}

test("valid values are kept", () => {
  const s = { ecLevel: "H", version: 7, margin: 10, size: 4096, fg: "#274472", bg: "#d5e0f2", transparent: true };
  assert.deepEqual(normalizeSettings(s), s);
});

test("each invalid field falls back on its own", () => {
  assert.deepEqual(
    normalizeSettings({ ecLevel: "X", version: 7, margin: "a", size: 2048, fg: "red", bg: "#FFFFFF", transparent: "yes" }),
    { ...DEFAULTS, version: 7, size: 2048 },
  );
});

test("numeric strings from form fields are accepted", () => {
  const s = normalizeSettings({ version: "7", margin: "12", size: "512" });
  assert.equal(s.version, 7);
  assert.equal(s.margin, 12);
  assert.equal(s.size, 512);
});

test("the margin is clamped to 4..20 and rounded", () => {
  assert.equal(normalizeSettings({ margin: 2 }).margin, 4);
  assert.equal(normalizeSettings({ margin: 0 }).margin, 4);
  assert.equal(normalizeSettings({ margin: 99 }).margin, 20);
  assert.equal(normalizeSettings({ margin: 6.6 }).margin, 7);
});

test("versions outside 0..40 and sizes outside the presets fall back", () => {
  assert.equal(normalizeSettings({ version: 41 }).version, 0);
  assert.equal(normalizeSettings({ version: -1 }).version, 0);
  assert.equal(normalizeSettings({ version: 2.5 }).version, 0);
  assert.equal(normalizeSettings({ size: 1000 }).size, 1024);
});

test("colours must be #rrggbb and are lower-cased", () => {
  assert.equal(normalizeSettings({ fg: "#ABCDEF" }).fg, "#abcdef");
  assert.equal(normalizeSettings({ fg: "#abc" }).fg, "#000000");
  assert.equal(normalizeSettings({ bg: "url(x)" }).bg, "#ffffff");
});

test("contrastRatio follows the WCAG formula", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#274472", "#274472"), 1);
});

test("the contrast warning", () => {
  assert.equal(hasContrastWarning(DEFAULTS), false);
  assert.equal(hasContrastWarning({ ...DEFAULTS, fg: "#274472", bg: "#d5e0f2" }), false);
  assert.equal(hasContrastWarning({ ...DEFAULTS, fg: "#777777", bg: "#888888" }), true);
  assert.equal(hasContrastWarning({ ...DEFAULTS, fg: "#ffffff", bg: "#000000" }), true);
  assert.equal(hasContrastWarning({ ...DEFAULTS, fg: "#ffff00", bg: "#000000", transparent: true }), true);
  assert.equal(hasContrastWarning({ ...DEFAULTS, fg: "#000000", bg: "#000000", transparent: true }), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatrix, CapacityError, QUIET_ZONE } from "../src/matrix.js";

test("QUIET_ZONE is 4 modules", () => {
  assert.equal(QUIET_ZONE, 4);
});

test("a short URL produces a square 25x25 matrix", () => {
  const m = createMatrix("https://example.com/");
  assert.equal(m.length, 25);
  for (const row of m) assert.equal(row.length, 25);
});

test("the top-left finder pattern is present", () => {
  const m = createMatrix("https://example.com/");
  assert.equal(m[0][0], true);
  assert.equal(m[0][6], true);
  assert.equal(m[6][0], true);
  assert.equal(m[6][6], true);
  assert.equal(m[1][1], false);
  assert.equal(m[3][3], true);
});

test("the maximum payload (2331 bytes) fits in version 40", () => {
  const m = createMatrix("a".repeat(2331));
  assert.equal(m.length, 177);
});

test("one byte more throws CapacityError", () => {
  assert.throws(
    () => createMatrix("a".repeat(2332)),
    (e) =>
      e instanceof CapacityError &&
      e instanceof Error &&
      e.message === "This URL is too long to fit in a QR code.",
  );
});

test("a huge input throws CapacityError quickly", () => {
  const start = performance.now();
  assert.throws(() => createMatrix("a".repeat(1_000_000)), CapacityError);
  assert.ok(performance.now() - start < 250, "should fail fast");
});

test("error correction L holds more than the M limit", () => {
  assert.equal(createMatrix("a".repeat(2953), { ecLevel: "L" }).length, 177);
  assert.throws(() => createMatrix("a".repeat(2954), { ecLevel: "L" }), CapacityError);
  assert.throws(() => createMatrix("a".repeat(2500), { ecLevel: "M" }), CapacityError);
});

test("error correction H holds at most 1273 bytes", () => {
  assert.equal(createMatrix("a".repeat(1273), { ecLevel: "H" }).length, 177);
  assert.throws(() => createMatrix("a".repeat(1274), { ecLevel: "H" }), CapacityError);
});

test("a higher error correction level needs a bigger grid", () => {
  const text = "https://example.com/";
  assert.equal(createMatrix(text, { ecLevel: "L" }).length, 25);
  assert.equal(createMatrix(text, { ecLevel: "H" }).length, 29);
});

test("a fixed version sets the grid size", () => {
  assert.equal(createMatrix("https://example.com/", { version: 10 }).length, 57);
  assert.equal(createMatrix("https://example.com/", { version: 40 }).length, 177);
});

test("a fixed version that is too small throws tooLongForSize", () => {
  assert.throws(
    () => createMatrix("https://example.com/" + "a".repeat(180), { version: 1 }),
    (e) => e instanceof CapacityError && e.code === "tooLongForSize",
  );
});

test("too long for any grid is tooLong even with a fixed version", () => {
  assert.throws(
    () => createMatrix("a".repeat(2332), { version: 40 }),
    (e) => e instanceof CapacityError && e.code === "tooLong",
  );
});

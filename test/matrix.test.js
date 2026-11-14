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

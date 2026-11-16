import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatrix, QUIET_ZONE } from "../src/matrix.js";
import { toSvg } from "../src/svg.js";

const matrix = createMatrix("https://example.com/");
const svg = toSvg(matrix);

test("the document is a standalone SVG with a 33-unit viewBox", () => {
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('viewBox="0 0 33 33"'));
});

test("the path contains exactly the dark modules, offset by the quiet zone", () => {
  const actual = new Set(
    [...svg.matchAll(/M(\d+),(\d+)/g)].map((m) => `${m[1]},${m[2]}`),
  );
  const expected = new Set();
  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (dark) expected.add(`${col + QUIET_ZONE},${row + QUIET_ZONE}`);
    }),
  );
  assert.deepEqual(actual, expected);
});

test("the root element has no width or height so it scales to its container", () => {
  const root = svg.match(/<svg[^>]*>/)[0];
  assert.ok(!/\swidth=/.test(root));
  assert.ok(!/\sheight=/.test(root));
});

test("the background is a white rect and the modules are black", () => {
  assert.ok(svg.includes('<rect width="33" height="33" fill="#ffffff"/>'));
  assert.ok(svg.includes('<path fill="#000000" d="'));
});

test("a wider margin grows the viewBox and offsets the modules", () => {
  const wide = toSvg(matrix, { margin: 10 });
  assert.ok(wide.includes('viewBox="0 0 45 45"'));
  const first = wide.match(/M(\d+),(\d+)/);
  assert.deepEqual([first[1], first[2]], ["10", "10"]);
});

test("custom colours are used for modules and background", () => {
  const coloured = toSvg(matrix, { fg: "#274472", bg: "#d5e0f2" });
  assert.ok(coloured.includes('<rect width="33" height="33" fill="#d5e0f2"/>'));
  assert.ok(coloured.includes('<path fill="#274472" d="'));
});

test("a transparent background has no rect", () => {
  const clear = toSvg(matrix, { bg: "#d5e0f2", transparent: true });
  assert.ok(!clear.includes("<rect"));
  assert.ok(clear.includes('<path fill="#000000" d="'));
});

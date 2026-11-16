import { QUIET_ZONE } from "./matrix.js";

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// `size` is an upper bound: every module gets the same whole number of pixels.
export function toPixels(
  matrix,
  { size: targetSize = 1024, margin = QUIET_ZONE, fg = "#000000", bg = "#ffffff", transparent = false } = {},
) {
  const n = matrix.length;
  const modules = n + 2 * margin;
  const scale = Math.max(1, Math.floor(targetSize / modules));
  const size = modules * scale;
  // Transparent pixels stay white so viewers that ignore alpha still show a light background.
  const light = transparent ? [255, 255, 255, 0] : [...rgb(bg), 255];
  const dark = [...rgb(fg), 255];
  const rowBytes = size * 4;
  const lightRow = new Uint8ClampedArray(rowBytes);
  for (let x = 0; x < rowBytes; x += 4) lightRow.set(light, x);
  const data = new Uint8ClampedArray(rowBytes * size);
  // Build each module row once, then copy it `scale` times.
  const row = new Uint8ClampedArray(rowBytes);
  for (let y = 0; y < modules; y++) {
    const cells = matrix[y - margin];
    let line = lightRow;
    if (cells) {
      row.set(lightRow);
      for (let col = 0; col < n; col++) {
        if (!cells[col]) continue;
        const x0 = (col + margin) * scale * 4;
        for (let x = x0; x < x0 + scale * 4; x += 4) row.set(dark, x);
      }
      line = row;
    }
    for (let k = 0; k < scale; k++) data.set(line, (y * scale + k) * rowBytes);
  }
  return { width: size, height: size, data };
}

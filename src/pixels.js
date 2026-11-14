import { QUIET_ZONE } from "./matrix.js";

export function toPixels(matrix, targetSize = 1024) {
  const n = matrix.length;
  const modules = n + 2 * QUIET_ZONE;
  const scale = Math.max(1, Math.floor(targetSize / modules));
  const size = modules * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!matrix[row][col]) continue;
      const x0 = (col + QUIET_ZONE) * scale;
      const y0 = (row + QUIET_ZONE) * scale;
      for (let y = y0; y < y0 + scale; y++) {
        for (let x = x0; x < x0 + scale; x++) {
          const i = (y * size + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { width: size, height: size, data };
}

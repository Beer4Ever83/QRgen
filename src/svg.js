import { QUIET_ZONE } from "./matrix.js";

export function toSvg(matrix) {
  const n = matrix.length;
  const size = n + 2 * QUIET_ZONE;
  let d = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (matrix[row][col]) {
        d += `M${col + QUIET_ZONE},${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path fill="#000" d="${d}"/>` +
    `</svg>`
  );
}

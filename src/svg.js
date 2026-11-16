import { QUIET_ZONE } from "./matrix.js";

export function toSvg(
  matrix,
  { margin = QUIET_ZONE, fg = "#000000", bg = "#ffffff", transparent = false } = {},
) {
  const n = matrix.length;
  const size = n + 2 * margin;
  let d = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (matrix[row][col]) {
        d += `M${col + margin},${row + margin}h1v1h-1z`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    (transparent ? "" : `<rect width="${size}" height="${size}" fill="${bg}"/>`) +
    `<path fill="${fg}" d="${d}"/>` +
    `</svg>`
  );
}

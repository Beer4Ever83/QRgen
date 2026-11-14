import { normalizeUrl, fileBaseName } from "./url.js";
import { createMatrix, CapacityError } from "./matrix.js";
import { toPixels } from "./pixels.js";
import { toSvg } from "./svg.js";

const form = document.querySelector("#qr-form");
const input = document.querySelector("#url-input");
const errorEl = document.querySelector("#error");
const result = document.querySelector("#result");
const preview = document.querySelector("#preview");
const encodedUrl = document.querySelector("#encoded-url");
const downloadPng = document.querySelector("#download-png");
const downloadSvg = document.querySelector("#download-svg");

let objectUrls = [];
let latest = 0;

function showError(message) {
  latest++;
  errorEl.textContent = message;
  errorEl.hidden = false;
  result.hidden = true;
}

function revokeObjectUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

function objectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

async function pngBlob(matrix) {
  const { width, height, data } = toPixels(matrix);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(data, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = ++latest;

  const normalized = normalizeUrl(input.value);
  if (!normalized.ok) return showError(normalized.error);
  const { url } = normalized;

  let matrix;
  try {
    matrix = createMatrix(url);
  } catch (e) {
    if (e instanceof CapacityError) return showError(e.message);
    throw e;
  }

  let png;
  try {
    png = await pngBlob(matrix);
  } catch {
    if (id === latest) showError("Could not generate the PNG.");
    return;
  }
  if (id !== latest) return;

  revokeObjectUrls();
  const svgUrl = objectUrl(new Blob([toSvg(matrix)], { type: "image/svg+xml" }));
  const base = fileBaseName(url);
  preview.src = svgUrl;
  preview.alt = "QR code for " + url;
  downloadSvg.href = svgUrl;
  downloadSvg.download = base + ".svg";
  downloadPng.href = objectUrl(png);
  downloadPng.download = base + ".png";
  encodedUrl.textContent = url;
  errorEl.hidden = true;
  result.hidden = false;
});

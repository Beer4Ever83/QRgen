import { normalizeUrl, fileBaseName } from "./url.js";
import { createMatrix, CapacityError } from "./matrix.js";
import { toPixels } from "./pixels.js";
import { toSvg } from "./svg.js";
import { HTML_LANG, t, resolveLanguage } from "./i18n.js";

const STORAGE_KEY = "qrgen.lang";

const form = document.querySelector("#qr-form");
const input = document.querySelector("#url-input");
const errorEl = document.querySelector("#error");
const result = document.querySelector("#result");
const preview = document.querySelector("#preview");
const encodedUrl = document.querySelector("#encoded-url");
const downloadPng = document.querySelector("#download-png");
const downloadSvg = document.querySelector("#download-svg");
const languages = document.querySelector("nav.languages");

let objectUrls = [];
let latest = 0;
let lang = resolveLanguage(readStoredLanguage());
let errorKey = null;
let resultUrl = null;

function readStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked (e.g. privacy mode): the choice lasts until reload.
  }
}

function render() {
  document.documentElement.lang = HTML_LANG[lang];
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(lang, el.dataset.i18n);
  }
  languages.setAttribute("aria-label", t(lang, "language"));
  for (const button of languages.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  if (errorKey) errorEl.textContent = t(lang, errorKey);
  if (resultUrl) preview.alt = t(lang, "alt", { url: resultUrl });
}

languages.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-lang]");
  if (!button) return;
  lang = resolveLanguage(button.dataset.lang);
  storeLanguage(lang);
  render();
});

function showError(key) {
  latest++;
  errorKey = key;
  resultUrl = null;
  errorEl.textContent = t(lang, key);
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
    if (e instanceof CapacityError) return showError(e.code);
    showError("generic");
    return;
  }

  let png;
  try {
    png = await pngBlob(matrix);
  } catch {
    if (id === latest) showError("png");
    return;
  }
  if (id !== latest) return;

  revokeObjectUrls();
  const svgUrl = objectUrl(new Blob([toSvg(matrix)], { type: "image/svg+xml" }));
  const base = fileBaseName(url);
  preview.src = svgUrl;
  resultUrl = url;
  errorKey = null;
  preview.alt = t(lang, "alt", { url });
  downloadSvg.href = svgUrl;
  downloadSvg.download = base + ".svg";
  downloadPng.href = objectUrl(png);
  downloadPng.download = base + ".png";
  encodedUrl.textContent = url;
  errorEl.hidden = true;
  result.hidden = false;
});

render();

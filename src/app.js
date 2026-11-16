import { normalizeUrl, fileBaseName } from "./url.js";
import { createMatrix, CapacityError } from "./matrix.js";
import { toPixels } from "./pixels.js";
import { toSvg } from "./svg.js";
import { HTML_LANG, t, resolveLanguage } from "./i18n.js";
import { DEFAULTS, MAX_VERSION, normalizeSettings, hasContrastWarning } from "./settings.js";

const STORAGE_KEY = "qrgen.lang";
const SETTINGS_KEY = "qrgen.settings";

const form = document.querySelector("#qr-form");
const input = document.querySelector("#url-input");
const errorEl = document.querySelector("#error");
const result = document.querySelector("#result");
const preview = document.querySelector("#preview");
const encodedUrl = document.querySelector("#encoded-url");
const downloadPng = document.querySelector("#download-png");
const downloadSvg = document.querySelector("#download-svg");
const languages = document.querySelector("nav.languages");
const advanced = document.querySelector("#advanced");
const fields = {
  ecLevel: document.querySelector("#ec-level"),
  version: document.querySelector("#version"),
  margin: document.querySelector("#margin"),
  size: document.querySelector("#size"),
  fg: document.querySelector("#fg"),
  bg: document.querySelector("#bg"),
  transparent: document.querySelector("#transparent"),
};
const contrastWarning = document.querySelector("#contrast-warning");
const resetButton = document.querySelector("#reset");

let objectUrls = [];
let latest = 0;
let lang = resolveLanguage(readStoredLanguage());
let errorKey = null;
let resultUrl = null;
// Last submitted valid URL; settings changes regenerate it.
let lastUrl = null;
let settings = normalizeSettings(readStoredSettings());

function readStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return null;
  }
}

function storeSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last until reload.
  }
}

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
    el.textContent = t(lang, el.dataset.i18n, el.dataset);
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

for (let v = 1; v <= MAX_VERSION; v++) {
  const side = 17 + 4 * v;
  fields.version.add(new Option(`${side}×${side}`, String(v)));
}

function writeFields() {
  fields.ecLevel.value = settings.ecLevel;
  fields.version.value = String(settings.version);
  fields.margin.value = String(settings.margin);
  fields.size.value = String(settings.size);
  fields.fg.value = settings.fg;
  fields.bg.value = settings.bg;
  fields.transparent.checked = settings.transparent;
  fields.bg.disabled = settings.transparent;
  contrastWarning.hidden = !hasContrastWarning(settings);
}

function applySettings(raw) {
  settings = normalizeSettings(raw);
  storeSettings();
  writeFields();
  if (lastUrl) generate(lastUrl);
}

advanced.addEventListener("change", () => {
  applySettings({
    ecLevel: fields.ecLevel.value,
    version: fields.version.value,
    margin: fields.margin.value,
    size: fields.size.value,
    fg: fields.fg.value,
    bg: fields.bg.value,
    transparent: fields.transparent.checked,
  });
});

// Colour pickers fire "input" while dragging; only the warning follows live.
advanced.addEventListener("input", (event) => {
  if (event.target !== fields.fg && event.target !== fields.bg) return;
  contrastWarning.hidden = !hasContrastWarning(
    normalizeSettings({ ...settings, fg: fields.fg.value, bg: fields.bg.value }),
  );
});

resetButton.addEventListener("click", () => applySettings(DEFAULTS));

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

async function pngBlob(matrix, options) {
  const { width, height, data } = toPixels(matrix, options);
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const normalized = normalizeUrl(input.value);
  if (!normalized.ok) {
    lastUrl = null;
    return showError(normalized.error);
  }
  lastUrl = normalized.url;
  generate(lastUrl);
});

async function generate(url) {
  const id = ++latest;
  const options = settings;

  let matrix;
  try {
    matrix = createMatrix(url, options);
  } catch (e) {
    if (e instanceof CapacityError) return showError(e.code);
    showError("generic");
    return;
  }

  let png;
  try {
    png = await pngBlob(matrix, options);
  } catch {
    if (id === latest) showError("png");
    return;
  }
  if (id !== latest) return;

  revokeObjectUrls();
  const svgUrl = objectUrl(new Blob([toSvg(matrix, options)], { type: "image/svg+xml" }));
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
}

writeFields();
render();

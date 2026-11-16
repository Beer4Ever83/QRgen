import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  HTML_LANG,
  MESSAGES,
  t,
  resolveLanguage,
} from "../src/i18n.js";
import { CapacityError } from "../src/matrix.js";

test("Italian is the default of three languages", () => {
  assert.deepEqual(LANGUAGES, ["it", "en", "es"]);
  assert.equal(DEFAULT_LANGUAGE, "it");
  assert.deepEqual(HTML_LANG, { it: "it", en: "en-US", es: "es-ES" });
});

test("every language translates every message", () => {
  const keys = Object.keys(MESSAGES.en).sort();
  for (const lang of LANGUAGES) {
    assert.deepEqual(Object.keys(MESSAGES[lang]).sort(), keys, lang);
    for (const key of keys) assert.ok(MESSAGES[lang][key], `${lang}.${key}`);
  }
});

test("English error copy is exact", () => {
  assert.equal(t("en", "empty"), "Please enter a URL.");
  assert.equal(t("en", "scheme"), "Only http and https URLs are supported.");
  assert.equal(t("en", "invalid"), "This doesn't look like a valid URL.");
  assert.equal(t("en", "tooLong"), "This URL is too long to fit in a QR code.");
  assert.equal(t("en", "generic"), "Could not generate the QR code.");
  assert.equal(t("en", "png"), "Could not generate the PNG.");
});

test("t fills in placeholders", () => {
  assert.equal(t("it", "alt", { url: "https://a.example/" }), "Codice QR per https://a.example/");
  assert.equal(t("en", "alt", { url: "x" }), "QR code for x");
  assert.equal(t("es", "alt", { url: "x" }), "Código QR de x");
});

for (const [value, lang] of [[null, "it"], ["it", "it"], ["en", "en"], ["es", "es"], ["fr", "it"], ["", "it"], ["constructor", "it"]]) {
  test(`resolveLanguage(${JSON.stringify(value)}) is ${lang}`, () => {
    assert.equal(resolveLanguage(value), lang);
  });
}

test("CapacityError carries the tooLong message key", () => {
  assert.equal(new CapacityError().code, "tooLong");
});

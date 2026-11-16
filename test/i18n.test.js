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

test("t fills in placeholders", () => {
  for (const lang of LANGUAGES) {
    const alt = t(lang, "alt", { url: "https://a.example/" });
    assert.ok(alt.includes("https://a.example/"), alt);
    assert.ok(!alt.includes("{"), alt);
  }
});

for (const [value, lang] of [[null, "it"], ["it", "it"], ["en", "en"], ["es", "es"], ["fr", "it"], ["", "it"], ["constructor", "it"]]) {
  test(`resolveLanguage(${JSON.stringify(value)}) is ${lang}`, () => {
    assert.equal(resolveLanguage(value), lang);
  });
}

test("CapacityError carries the tooLong message key", () => {
  assert.equal(new CapacityError().code, "tooLong");
});

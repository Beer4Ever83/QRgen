import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeUrl,
  fileBaseName,
  EMPTY_ERROR,
  SCHEME_ERROR,
  INVALID_ERROR,
} from "../src/url.js";

const okCases = [
  ["https://example.com", "https://example.com/"],
  ["  https://example.com  ", "https://example.com/"],
  ["HTTPS://Example.COM", "https://example.com/"],
  ["http://example.com/a?b=1#c", "http://example.com/a?b=1#c"],
  ["example.com", "https://example.com/"],
  ["localhost:3000/x", "https://localhost:3000/x"],
  ["example.com:8080", "https://example.com:8080/"],
  ["https://ü.com/ä", "https://xn--tda.com/%C3%A4"],
];

for (const [input, url] of okCases) {
  test(`normalizeUrl accepts ${JSON.stringify(input)}`, () => {
    assert.deepEqual(normalizeUrl(input), { ok: true, url });
  });
}

const errorCases = [
  ["", EMPTY_ERROR],
  ["   ", EMPTY_ERROR],
  ["javascript:alert(1)", SCHEME_ERROR],
  ["mailto:a@b.com", SCHEME_ERROR],
  ["ftp://example.com", SCHEME_ERROR],
  ["hello world", INVALID_ERROR],
  ["https://", INVALID_ERROR],
];

for (const [input, error] of errorCases) {
  test(`normalizeUrl rejects ${JSON.stringify(input)}`, () => {
    assert.deepEqual(normalizeUrl(input), { ok: false, error });
  });
}

test("errors are reported as message keys", () => {
  assert.equal(EMPTY_ERROR, "empty");
  assert.equal(SCHEME_ERROR, "scheme");
  assert.equal(INVALID_ERROR, "invalid");
});

const nameCases = [
  ["https://example.com/", "qr-example.com"],
  ["https://xn--tda.com/", "qr-xn--tda.com"],
  ["http://[::1]:8080/", "qr----1-"],
];

for (const [url, name] of nameCases) {
  test(`fileBaseName(${url})`, () => {
    assert.equal(fileBaseName(url), name);
  });
}

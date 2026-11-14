# Vendored dependencies

## qrcode-generator

- Source: https://www.npmjs.com/package/qrcode-generator
- Version: 2.0.4
- File: `qrcode-generator/qrcode.mjs` (unmodified copy of `dist/qrcode.mjs`)
- Licence: MIT, (c) Kazuhiko Arase (header preserved in the file)

### How to update

1. In a new empty temp dir, run `npm pack qrcode-generator@<version>` and extract the tarball.
2. Copy `package/dist/qrcode.mjs` to `vendor/qrcode-generator/qrcode.mjs` without modifying it.
3. Update the version above and run `npm test`.

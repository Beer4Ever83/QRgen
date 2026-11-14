# QRgen
A client-side QR-code generator: enter a URL, get a QR code you can download as PNG or SVG. Everything runs in the browser; the URL never leaves it.

## Run locally
```sh
npm start
```
Then open http://127.0.0.1:8000/. There is no build step: the published files are the source files.

## Test
```sh
npm install
npx playwright install chromium
npm test
```
`npm test` runs the unit tests and the Playwright end-to-end tests (headless Chromium, started and stopped by the tests).

## Release
Not set up yet.

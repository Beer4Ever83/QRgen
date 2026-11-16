# QRgen
A client-side QR-code generator: enter a URL, get a QR code you can download as PNG or SVG. Everything runs in the browser; the URL never leaves it.

**Try it at https://beer4ever83.github.io/QRgen/**

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
Pushing a version tag (`X.Y.Z`, no `v` prefix) runs the tests and then deploys the page to GitHub Pages (https://beer4ever83.github.io/QRgen/):
```sh
git tag 1.0.0
git push origin 1.0.0
```
Tests also run on every push and pull request.

export const LANGUAGES = ["it", "en", "es"];
export const DEFAULT_LANGUAGE = "it";
export const HTML_LANG = { it: "it", en: "en-US", es: "es-ES" };

export const MESSAGES = {
  it: {
    language: "Lingua",
    label: "URL",
    generate: "Genera",
    downloadPng: "Scarica PNG",
    downloadSvg: "Scarica SVG",
    alt: "Codice QR per {url}",
    empty: "Inserisci un URL.",
    scheme: "Sono supportati solo URL http e https.",
    invalid: "Questo non sembra un URL valido.",
    tooLong: "Questo URL è troppo lungo per stare in un codice QR.",
    generic: "Impossibile generare il codice QR.",
    png: "Impossibile generare il PNG.",
  },
  en: {
    language: "Language",
    label: "URL",
    generate: "Generate",
    downloadPng: "Download PNG",
    downloadSvg: "Download SVG",
    alt: "QR code for {url}",
    empty: "Please enter a URL.",
    scheme: "Only http and https URLs are supported.",
    invalid: "This doesn't look like a valid URL.",
    tooLong: "This URL is too long to fit in a QR code.",
    generic: "Could not generate the QR code.",
    png: "Could not generate the PNG.",
  },
  es: {
    language: "Idioma",
    label: "URL",
    generate: "Generar",
    downloadPng: "Descargar PNG",
    downloadSvg: "Descargar SVG",
    alt: "Código QR de {url}",
    empty: "Introduce una URL.",
    scheme: "Solo se admiten URL http y https.",
    invalid: "Esto no parece una URL válida.",
    tooLong: "Esta URL es demasiado larga para caber en un código QR.",
    generic: "No se ha podido generar el código QR.",
    png: "No se ha podido generar el PNG.",
  },
};

export function t(lang, key, params = {}) {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (_, name) => params[name]);
}

export function resolveLanguage(value) {
  return LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE;
}

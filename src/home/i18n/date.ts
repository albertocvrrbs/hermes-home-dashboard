// Dates in the plugin's language (the host's, via setHostLanguage), not the browser's.
// Kept free of the locale glob in ./index so pure modules and node tests can import it.
let locale: string | undefined;

/** Called by ./index whenever the active language changes. */
export function setDateLocale(language: string | undefined): void {
  locale = language;
}

/** `fmtDate(d, { weekday: "long", day: "numeric", month: "long" })` -> "viernes, 27 de noviembre" under es.
 *  Falls back to the browser locale when Intl rejects the language tag. */
export function fmtDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}

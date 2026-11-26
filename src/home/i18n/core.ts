// Pure translation helpers, kept free of runtime imports so they can be
// unit-tested without the SDK/React graph (same pattern as tokenSeries.ts).

/** One language's strings: flat dotted keys → text with `{name}` slots. */
export type Dictionary = Readonly<Record<string, string>>;

/** Every shipped dictionary, keyed by language id (the locale file name). */
export type Dictionaries = Readonly<Record<string, Dictionary>>;

export type TranslateVars = Readonly<Record<string, string | number>>;

export const FALLBACK_LANGUAGE = "en";

/** Fill `{name}` slots. Unknown slots stay visible so a typo is obvious. */
export function interpolate(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (slot, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : slot,
  );
}

/** Look `key` up in `language`, then English, then show the key itself. */
export function translate(
  dictionaries: Dictionaries,
  language: string,
  key: string,
  vars?: TranslateVars,
): string {
  const text = dictionaries[language]?.[key] ?? dictionaries[FALLBACK_LANGUAGE]?.[key] ?? key;
  return interpolate(text, vars);
}

/** Pick the first candidate tag we ship, matching exactly ("pt-br") or by
 *  base language ("es-MX" → "es"). Candidates come in priority order: the
 *  host's UI language first, then the browser's. Falls back to English. */
export function resolveLanguage(
  candidates: readonly (string | null | undefined)[],
  available: readonly string[],
): string {
  const have = new Set(available.map((a) => a.toLowerCase()));
  for (const raw of candidates) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, "-");
    if (!tag) continue;
    if (have.has(tag)) return tag;
    const base = tag.split("-")[0];
    if (have.has(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

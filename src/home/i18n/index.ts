// Shared translation layer for every Home widget and the edit/grid chrome.
//
// Adding a language is a one-file change: drop `locales/<id>.ts` (copy
// `en.ts`, translate the values, keep the keys). Vite's glob below picks it up
// at build time; no registration anywhere else.
//
// The active language follows the host: Hermes Desktop / Webapp report
// `display.language` through `ctx.i18n`, the web dashboard through its own
// language picker (`useI18n`). Without either, the browser's languages are
// used. Anything we don't ship falls back to English, key by key.
import { useEffect, useState } from "react";
import { resolveLanguage, translate, type Dictionaries, type TranslateVars } from "./core";
import type { MessageKey } from "./locales/en";
import { fmtDate, setDateLocale } from "./date";

export { fmtDate };

export type { MessageKey } from "./locales/en";

const modules = import.meta.glob<{ default: Record<string, string> }>("./locales/*.ts", {
  eager: true,
});

/** Shipped dictionaries keyed by language id (the file name, lowercased). */
export const DICTIONARIES: Dictionaries = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    path.replace(/^.*\//, "").replace(/\.ts$/, "").toLowerCase(),
    mod.default,
  ]),
);

export const LANGUAGES: readonly string[] = Object.keys(DICTIONARIES);

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

let hostLanguage: string | null = null;
const listeners = new Set<() => void>();

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function computeLanguage(): string {
  return resolveLanguage([hostLanguage, ...browserLanguages()], LANGUAGES);
}

let current = computeLanguage();
setDateLocale(current);

/** Report the host's UI language (null = the host doesn't expose one). */
export function setHostLanguage(language: string | null | undefined): void {
  hostLanguage = language ?? null;
  const next = computeLanguage();
  if (next === current) return;
  current = next;
  setDateLocale(next);
  listeners.forEach((l) => l());
}

export function currentLanguage(): string {
  return current;
}

// One stable translator per language, so `t` can sit in hook dependency lists
// and still change identity when the language does.
const translators = new Map<string, Translate>();
function translatorFor(language: string): Translate {
  let fn = translators.get(language);
  if (!fn) {
    fn = (key, vars) => translate(DICTIONARIES, language, key, vars);
    translators.set(language, fn);
  }
  return fn;
}

/** Non-reactive translator for code outside React (stores, event handlers). */
export const t: Translate = (key, vars) => translatorFor(current)(key, vars);

/** Reactive translator: re-renders the caller when the language changes. */
export function useT(): Translate {
  const [language, setLanguage] = useState(current);
  useEffect(() => {
    const onChange = () => setLanguage(current);
    listeners.add(onChange);
    onChange(); // the host may have reported its language before we subscribed
    return () => { listeners.delete(onChange); };
  }, []);
  return translatorFor(language);
}

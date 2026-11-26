import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { interpolate, resolveLanguage, translate } from "../src/home/i18n/core.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

const LOCALES_DIR = fileURLToPath(new URL("../src/home/i18n/locales/", import.meta.url));
const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("en and es have identical key sets", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test("every shipped locale mirrors en: same keys, same {slots}, no empty strings", async () => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".ts"));
  assert.ok(files.includes("en.ts") && files.includes("es.ts"));
  for (const file of files) {
    const { default: dict } = await import(new URL(`../src/home/i18n/locales/${file}`, import.meta.url));
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort(), `${file}: key set differs from en.ts`);
    for (const [key, text] of Object.entries(dict)) {
      assert.equal(typeof text, "string", `${file}: ${key}`);
      assert.ok(text.length > 0, `${file}: ${key} is empty`);
      assert.deepEqual(slots(text), slots(en[key]), `${file}: ${key} placeholders differ from en`);
    }
  }
});

test("Spanish strings use tú, never voseo", () => {
  const voseo = /\b(tenés|podés|querés|sabés|hacé|mirá|agregá|elegí|arrastrá|vos)\b/i;
  for (const [key, text] of Object.entries(es)) assert.ok(!voseo.test(text), `${key}: ${text}`);
});

test("translate falls back to English, then to the key", () => {
  const dicts = { en: { a: "A {n}", b: "B" }, es: { a: "a {n}" } };
  assert.equal(translate(dicts, "es", "a", { n: 2 }), "a 2");
  assert.equal(translate(dicts, "es", "b"), "B");
  assert.equal(translate(dicts, "fr", "a", { n: 1 }), "A 1");
  assert.equal(translate(dicts, "es", "missing.key"), "missing.key");
});

test("interpolate fills known slots and leaves unknown ones visible", () => {
  assert.equal(interpolate("{n} of {total}", { n: 3 }), "3 of {total}");
  assert.equal(interpolate("${cost} today", { cost: "1.50" }), "$1.50 today");
  assert.equal(interpolate("plain"), "plain");
});

test("resolveLanguage prefers the host, matches base tags, falls back to en", () => {
  const have = ["en", "es"];
  assert.equal(resolveLanguage(["es"], have), "es");
  assert.equal(resolveLanguage(["es-MX", "en-US"], have), "es");
  assert.equal(resolveLanguage(["es_419"], have), "es");
  assert.equal(resolveLanguage([null, "es-AR"], have), "es");
  assert.equal(resolveLanguage(["en", "es-MX"], have), "en"); // host language wins over the browser
  assert.equal(resolveLanguage(["fr", "de"], have), "en");
  assert.equal(resolveLanguage([], have), "en");
});

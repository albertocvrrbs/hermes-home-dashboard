import assert from "node:assert/strict";
import test from "node:test";

import {
  effortLabel, NO_MODEL, mergeSessionInfo, modelDisplayName, modelFromSessionRow, modelSwitchValue, presetKey, readPresets,
  sessionModelLabel, speedValue, writePreset,
} from "../src/board/sessionModel.ts";
import { pickerSdk } from "../src/desktop/modelMenuSdk.ts";
import en from "../src/home/i18n/locales/en.ts";
import es from "../src/home/i18n/locales/es.ts";

test("a board pick is always a session-scoped switch, never the profile default", () => {
  assert.equal(modelSwitchValue("deepseek-v4-flash", "deepseek"), "deepseek-v4-flash --provider deepseek --session");
  assert.equal(modelSwitchValue(" gpt-5.5 ", ""), "gpt-5.5 --session");
  assert.equal(speedValue("priority"), "fast");
  assert.equal(speedValue("normal"), "normal");
  assert.equal(speedValue(""), "normal");
  assert.equal(speedValue("ultrafast"), "ultrafast");
});

test("session.info merges over the last known choice; a lazy resume keeps effort pending", () => {
  const lazy = mergeSessionInfo(NO_MODEL, { model: "claude-opus-5-5", provider: "anthropic", lazy: true });
  assert.equal(lazy.model, "claude-opus-5-5");
  assert.equal(lazy.provider, "anthropic");
  assert.equal(lazy.effortPending, true, "the lazy resume reports no effort");
  const built = mergeSessionInfo(lazy, { model: "claude-opus-5-5", reasoning_effort: "high", reasoning_effort_wire: "high", fast: false, service_tier: "" });
  assert.equal(built.effort, "high");
  assert.equal(built.effortPending, false);
  assert.equal(built.provider, "anthropic", "a payload without provider keeps the known one");
  assert.deepEqual(mergeSessionInfo(built, null), built);
  const off = mergeSessionInfo(built, { reasoning_effort: "none" });
  assert.equal(off.effort, "none");
});

test("the web dashboard reads the model from the stored session row", () => {
  const row = { model: "deepseek-v4-flash", billing_provider: "deepseek", model_config: JSON.stringify({ reasoning_config: { enabled: true, effort: "low" } }) };
  const m = modelFromSessionRow(row);
  assert.equal(m.model, "deepseek-v4-flash");
  assert.equal(m.provider, "deepseek");
  assert.equal(m.effort, "low");
  assert.equal(m.effortPending, false);
  assert.equal(modelFromSessionRow({ model: "x", model_config: "{broken" }).effortPending, true);
  assert.equal(modelFromSessionRow({ model: "x", model_config: { reasoning_config: { enabled: false } } }).effort, "none");
  assert.deepEqual(modelFromSessionRow(null), NO_MODEL);
});

test("model names read like the Desktop composer pill", () => {
  assert.equal(modelDisplayName("claude-opus-5-5"), "Opus 5.5");
  assert.equal(modelDisplayName("anthropic/claude-haiku-4-5-20251001"), "Haiku 4.5");
  assert.equal(modelDisplayName("deepseek-v4-flash"), "DeepSeek V4 · Flash");
  assert.equal(modelDisplayName("gpt-5.5"), "GPT-5.5");
  assert.equal(modelDisplayName("gemini-2.5-pro"), "Gemini 2.5 Pro");
  assert.equal(modelDisplayName("glm-5.2"), "GLM 5.2");
  assert.equal(modelDisplayName("claude-sonnet-5[1m]"), "Sonnet 5 · 1M");
  assert.equal(modelDisplayName("  "), "");
  assert.equal(sessionModelLabel({ ...NO_MODEL, model: "deepseek-v4-flash", effort: "high", effortPending: false }), "DeepSeek V4 · Flash · High");
  assert.equal(sessionModelLabel({ ...NO_MODEL, model: "gpt-5.5", effort: "high" }), "GPT-5.5", "pending effort isn't shown");
  assert.equal(sessionModelLabel({ ...NO_MODEL, model: "gpt-5.5", effort: "", effortPending: false }), "GPT-5.5");
  assert.equal(sessionModelLabel(NO_MODEL), "");
  assert.equal(effortLabel({ ...NO_MODEL, effort: "xhigh", effortPending: false }), "XHigh");
  assert.equal(effortLabel({ ...NO_MODEL, effort: "none", effortPending: false }), "Off");
  assert.equal(effortLabel({ ...NO_MODEL, effort: "high" }), "", "unknown while pending");
});

test("per-model presets are remembered per provider::model and stay bounded", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  writePreset(storage, "DeepSeek", "deepseek-v4-flash", { effort: "low" });
  writePreset(storage, "deepseek", "deepseek-v4-flash", { serviceTier: "normal" });
  assert.deepEqual(readPresets(storage)[presetKey("deepseek", "deepseek-v4-flash")], { effort: "low", serviceTier: "normal" });
  for (let i = 0; i < 80; i++) writePreset(storage, "p", `m${i}`, { effort: "high" });
  assert.ok(Object.keys(readPresets(storage)).length <= 60);
  assert.deepEqual(readPresets({ getItem: () => "not json" }), {});
  assert.deepEqual(readPresets(null), {});
  writePreset(null, "p", "m", { effort: "low" }); // no storage: a no-op, never a throw
});

test("the picker only mounts when the Desktop SDK exports the menu", () => {
  const C = () => null;
  const full = {
    ModelCatalogMenu: C, ModelMenuCloseContext: { Provider: { $$typeof: Symbol.for("react.provider") } },
    DropdownMenu: C, DropdownMenuTrigger: C, DropdownMenuContent: C, Button: C, icons: { ChevronDown: C },
    useQueryClient: () => ({}), surfaceModelSwitchConfirm: async () => true,
    host: { request: async function (m) { return [this === full.host, m]; }, notifyError() {} },
  };
  const sdk = pickerSdk(full);
  assert.ok(sdk);
  assert.equal(sdk.Chevron, C);
  assert.ok(sdk.surfaceModelSwitchConfirm && sdk.request && sdk.notifyError);
  return sdk.request("model.options").then((r) => {
    assert.deepEqual(r, [true, "model.options"], "host.request keeps its receiver");
    assert.equal(pickerSdk({ ...full, ModelCatalogMenu: undefined }), null, "older Desktop: no menu, no picker");
    assert.equal(pickerSdk({ ...full, ModelMenuCloseContext: undefined }), null);
    assert.equal(pickerSdk(null), null);
    const bare = pickerSdk({ ...full, Button: undefined, icons: undefined, surfaceModelSwitchConfirm: undefined, host: undefined });
    assert.ok(bare, "optional parts degrade on their own");
    assert.equal(bare.Button, undefined);
    assert.equal(bare.request, undefined);
  });
});

test("model picker copy exists in en and es with the same slots", () => {
  for (const key of ["board.chat.model.title", "board.chat.model.titleNoProvider", "board.chat.model.readonly", "board.chat.model.switchFailed", "board.chat.model.refresh"]) {
    assert.ok(en[key], key);
    assert.ok(es[key], key);
    assert.deepEqual((en[key].match(/\{\w+\}/g) ?? []).sort(), (es[key].match(/\{\w+\}/g) ?? []).sort(), key);
  }
});

test("the Desktop language probe key has no dots (the app reads dotted keys as nested paths)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/desktop/index.tsx", import.meta.url), "utf8");
  const probe = /const LANGUAGE_PROBE = "([^"]+)"/.exec(src)?.[1];
  assert.ok(probe, "probe key found");
  assert.ok(!probe.includes("."), probe);
});

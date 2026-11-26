import assert from "node:assert/strict";
import test from "node:test";

import { coerceGroupBy, groupUsage } from "../src/home/widgets/tokenSeries.ts";
import {
  arrangeSessions, coerceSessionSort, coerceTokenFloor, sessionTokens,
} from "../src/home/widgets/sessionSort.ts";

// ── Tokens: group by provider / by model ────────────────────────────────

const rows = [
  { model: "claude-opus", provider: "anthropic", input_tokens: 100, output_tokens: 900, estimated_cost: 5 },
  { model: "claude-sonnet", provider: "anthropic", input_tokens: 50, output_tokens: 150, estimated_cost: 1 },
  { model: "claude-sonnet", provider: "openrouter", input_tokens: 100, output_tokens: 100, estimated_cost: 0.5 },
  { model: "deepseek-flash", provider: "deepseek", input_tokens: 300, output_tokens: 0, estimated_cost: 0.1 },
  { model: "claude-sonnet", provider: "", input_tokens: 10, output_tokens: 0, estimated_cost: 0 },
];

test("groupUsage sums by provider, largest first, with shares", () => {
  const g = groupUsage(rows, "provider");
  assert.deepEqual(g.map((x) => [x.key, x.tokens]), [
    ["anthropic", 1200], ["deepseek", 300], ["openrouter", 200], ["", 10],
  ]);
  assert.equal(g[0].cost, 6);
  assert.ok(Math.abs(g.reduce((n, x) => n + x.share, 0) - 100) < 1e-9);
});

test("groupUsage merges a model served by several providers", () => {
  const g = groupUsage(rows, "model");
  assert.deepEqual(g.map((x) => [x.key, x.tokens]), [
    ["claude-opus", 1000], ["claude-sonnet", 410], ["deepseek-flash", 300],
  ]);
  assert.equal(g[1].cost, 1.5);
});

test("groupUsage works on the provider-less by_model fallback and drops empty rows", () => {
  const byModel = [
    { model: "a", input_tokens: 1, output_tokens: 1, estimated_cost: 0 },
    { model: "b", input_tokens: 0, output_tokens: 0, estimated_cost: 0 },
  ];
  assert.deepEqual(groupUsage(byModel, "model").map((x) => x.key), ["a"]);
  assert.deepEqual(groupUsage(byModel, "provider").map((x) => x.key), [""]);
  assert.deepEqual(groupUsage([], "model"), []);
});

test("coerceGroupBy defaults unknown persisted values to off", () => {
  assert.equal(coerceGroupBy("provider"), "provider");
  assert.equal(coerceGroupBy("model"), "model");
  assert.equal(coerceGroupBy(undefined), "off");
  assert.equal(coerceGroupBy("bogus"), "off");
});

// ── Sessions: sort / filter by token usage ──────────────────────────────

const sessions = [
  { id: "a", input_tokens: 5_000, output_tokens: 1_000 },
  { id: "b", input_tokens: 200_000, output_tokens: 50_000 },
  { id: "c", input_tokens: 0, output_tokens: 0 },
  { id: "d", input_tokens: 9_000, output_tokens: 3_000 },
  { id: "e", input_tokens: 200_000, output_tokens: 50_000 },
];

test("recent keeps the backend order; tokens sorts heaviest first with recency ties", () => {
  assert.deepEqual(arrangeSessions(sessions, "recent", 0).map((s) => s.id), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(arrangeSessions(sessions, "tokens", 0).map((s) => s.id), ["b", "e", "d", "a", "c"]);
});

test("the token floor filters on input + output and composes with sorting", () => {
  assert.deepEqual(arrangeSessions(sessions, "recent", 10_000).map((s) => s.id), ["b", "d", "e"]);
  assert.deepEqual(arrangeSessions(sessions, "tokens", 100_000).map((s) => s.id), ["b", "e"]);
  assert.deepEqual(arrangeSessions(sessions, "tokens", 1_000_000), []);
});

test("arrangeSessions never mutates its input", () => {
  const copy = sessions.map((s) => ({ ...s }));
  arrangeSessions(sessions, "tokens", 0);
  assert.deepEqual(sessions, copy);
});

test("session helpers tolerate missing counts and unknown persisted props", () => {
  assert.equal(sessionTokens({}), 0);
  assert.equal(coerceSessionSort("tokens"), "tokens");
  assert.equal(coerceSessionSort("x"), "recent");
  assert.equal(coerceTokenFloor(100_000), 100_000);
  assert.equal(coerceTokenFloor(123), 0);
});

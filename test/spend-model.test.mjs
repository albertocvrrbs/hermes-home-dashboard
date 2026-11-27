import assert from "node:assert/strict";
import test from "node:test";

import {
  CAP_STEPS, amountBasis, capState, coerceCap, coerceSpendRange, coerceTopMode,
  coveredByBrand, formatCap, formatUsd, planBrand, stepCap,
} from "../src/home/widgets/spendModel.ts";

test("persisted Spend props coerce to safe defaults", () => {
  assert.equal(coerceSpendRange("today"), "today");
  assert.equal(coerceSpendRange("week"), "week");
  assert.equal(coerceSpendRange("halfyear"), "month");
  assert.equal(coerceSpendRange(undefined), "month");
  assert.equal(coerceTopMode("real"), "real");
  assert.equal(coerceTopMode(1), "all");
  assert.equal(coerceCap(50), 50);
  assert.equal(coerceCap(37.5), 37.5); // hand-edited layouts keep a custom cap
  for (const bad of [-5, 0, NaN, Infinity, "50", null, true]) assert.equal(coerceCap(bad), 0);
});

test("the cap stepper walks the steps and recovers from an off-step value", () => {
  assert.equal(stepCap(0, 1), 5);
  assert.equal(stepCap(5, -1), 0);
  assert.equal(stepCap(0, -1), 0);
  assert.equal(stepCap(37.5, 1), 50);
  assert.equal(stepCap(37.5, -1), 25);
  const last = CAP_STEPS[CAP_STEPS.length - 1];
  assert.equal(stepCap(last, 1), last);
});

test("capState: over beats pace beats near; no cap is off", () => {
  assert.equal(capState(10, 100, 0), "off");
  assert.equal(capState(50, 60, 50), "over");
  assert.equal(capState(20, 55, 50), "pace");
  assert.equal(capState(41, 45, 50), "near");
  assert.equal(capState(10, 20, 50), "ok");
});

test("formatUsd is compact and never prints negatives or NaN", () => {
  assert.equal(formatUsd(1818.0336), "$1,818");
  assert.equal(formatUsd(56.5725), "$56.57");
  assert.equal(formatUsd(0.41), "$0.41");
  assert.equal(formatUsd(0.0035), "<$0.01");
  assert.equal(formatUsd(0), "$0");
  assert.equal(formatUsd(-3), "$0");
  assert.equal(formatUsd(NaN), "$0");
});

test("covered providers merge by plan brand, largest first", () => {
  assert.equal(planBrand("anthropic"), "Claude");
  assert.equal(planBrand("claude-subscription-directsdk-experimental"), "Claude");
  assert.equal(planBrand("openai-codex"), "ChatGPT");
  assert.equal(planBrand("acme"), "acme");
  assert.deepEqual(
    coveredByBrand([
      { provider: "openai-codex", cost: 3 },
      { provider: "anthropic", cost: 1801.61 },
      { provider: "claude-subscription-directsdk-experimental", cost: 16.42 },
      { provider: "copilot", cost: 0 },
    ]).map((r) => [r.brand, Math.round(r.cost * 100) / 100]),
    [["Claude", 1818.03], ["ChatGPT", 3]],
  );
});

test("amountBasis marks estimated vs invoiced money", () => {
  assert.equal(amountBasis({ estimated: 2, actual: 0 }), "estimated");
  assert.equal(amountBasis({ estimated: 0, actual: 2 }), "actual");
  assert.equal(amountBasis({ estimated: 1, actual: 2 }), "mixed");
  assert.equal(amountBasis({ estimated: 0, actual: 0 }), "estimated");
});

test("formatCap shows whole dollars", () => {
  assert.equal(formatCap(5), "$5");
  assert.equal(formatCap(2500), "$2,500");
});

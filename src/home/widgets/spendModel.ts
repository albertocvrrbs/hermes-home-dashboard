// Pure helpers for the Spend widget, kept React-free for unit testing (same
// pattern as tokenSeries.ts / sessionSort.ts).

/** Range keys sent to the backend `/spend?period=`. */
export type SpendRange = "today" | "week" | "month";
export const SPEND_RANGES: readonly SpendRange[] = ["today", "week", "month"];

export function coerceSpendRange(value: unknown): SpendRange {
  return SPEND_RANGES.includes(value as SpendRange) ? (value as SpendRange) : "month";
}

/** Which sessions the top list ranks: every cost, or real (metered) money only. */
export type TopMode = "all" | "real";
export const TOP_MODES: readonly TopMode[] = ["all", "real"];

export function coerceTopMode(value: unknown): TopMode {
  return TOP_MODES.includes(value as TopMode) ? (value as TopMode) : "all";
}

/** Monthly cap steps in USD for the hover stepper. 0 = no cap. */
export const CAP_STEPS: readonly number[] = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500];

/** A persisted cap is any finite non-negative number (a hand-edited layout may
 *  hold one that is not a step); anything else means no cap. */
export function coerceCap(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Next/previous cap step from the current value (which may sit between steps). */
export function stepCap(current: number, dir: 1 | -1): number {
  if (dir > 0) return CAP_STEPS.find((s) => s > current) ?? CAP_STEPS[CAP_STEPS.length - 1];
  for (let i = CAP_STEPS.length - 1; i >= 0; i--) if (CAP_STEPS[i] < current) return CAP_STEPS[i];
  return 0;
}

/** Where real monthly spend stands against the cap:
 *  - off   no cap set
 *  - ok    comfortably under it
 *  - near  spend already at 80% or more of the cap
 *  - pace  under the cap so far, but the month-end projection reaches it
 *  - over  spend has reached the cap */
export type CapState = "off" | "ok" | "near" | "pace" | "over";

export const NEAR_CAP = 0.8;

export function capState(spent: number, projection: number, cap: number): CapState {
  if (!(cap > 0)) return "off";
  if (spent >= cap) return "over";
  if (projection >= cap) return "pace";
  if (spent >= cap * NEAR_CAP) return "near";
  return "ok";
}

/** Compact USD: `$1,818`, `$56.57`, `$0.41`, `<$0.01`, `$0`. Always en-US
 *  digits so amounts read the same in every UI language. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}

/** Cap amounts are whole dollars: `$5`, `$1,000`. */
export function formatCap(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Brand of the plan behind a subscription-covered provider, for labels such
 *  as "Claude subscription". Unknown providers keep their id. */
const PLAN_BRANDS: Record<string, string> = {
  anthropic: "Claude",
  "claude-code": "Claude",
  "openai-codex": "ChatGPT",
  copilot: "Copilot",
  "copilot-acp": "Copilot",
};

export function planBrand(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (PLAN_BRANDS[p]) return PLAN_BRANDS[p];
  if (p.includes("claude")) return "Claude";
  return provider || "?";
}

/** Merge covered providers that share a plan brand (e.g. two Claude routes). */
export function coveredByBrand(rows: readonly { provider: string; cost: number }[]): { brand: string; cost: number }[] {
  const acc = new Map<string, number>();
  for (const r of rows) acc.set(planBrand(r.provider), (acc.get(planBrand(r.provider)) ?? 0) + (r.cost ?? 0));
  return [...acc.entries()]
    .map(([brand, cost]) => ({ brand, cost }))
    .filter((r) => r.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}

/** How an amount was priced: every dollar invoiced, none, or some. */
export type Basis = "actual" | "estimated" | "mixed";

export function amountBasis(b: { estimated: number; actual: number }): Basis {
  if (b.actual > 0 && b.estimated > 0) return "mixed";
  return b.actual > 0 ? "actual" : "estimated";
}

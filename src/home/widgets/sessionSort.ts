// Pure sort/filter helpers for the Sessions widget, kept React-free for unit
// testing (same pattern as tokenSeries.ts).
import type { SessionInfo } from "@/api-types";

export type SessionSort = "recent" | "tokens";
export const SESSION_SORTS: readonly SessionSort[] = ["recent", "tokens"];

/** Minimum-token filter steps (input + output). 0 = show everything. */
export const TOKEN_FLOORS: readonly number[] = [0, 10_000, 100_000, 1_000_000];

export function coerceSessionSort(value: unknown): SessionSort {
  return SESSION_SORTS.includes(value as SessionSort) ? (value as SessionSort) : "recent";
}

export function coerceTokenFloor(value: unknown): number {
  return TOKEN_FLOORS.includes(value as number) ? (value as number) : 0;
}

export function sessionTokens(s: Pick<SessionInfo, "input_tokens" | "output_tokens">): number {
  return (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
}

/** Filter by the token floor, then order. "recent" keeps the backend order
 *  (most recent first); "tokens" is heaviest first, recency breaking ties.
 *  Never mutates the input. */
export function arrangeSessions<T extends Pick<SessionInfo, "input_tokens" | "output_tokens">>(
  sessions: readonly T[],
  sort: SessionSort,
  minTokens: number,
): T[] {
  const kept = sessions
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => sessionTokens(s) >= minTokens);
  if (sort === "tokens") {
    kept.sort((a, b) => sessionTokens(b.s) - sessionTokens(a.s) || a.i - b.i);
  }
  return kept.map(({ s }) => s);
}

import assert from "node:assert/strict";
import test from "node:test";

import { Cancelled, TimeoutError, fetchRetry, withTimeout } from "../src/home/fetchGuard.ts";

const never = () => new Promise(() => {});

test("withTimeout rejects a request that never settles", async () => {
  await assert.rejects(withTimeout(never, 20), TimeoutError);
});

test("withTimeout passes the value and the error through", async () => {
  assert.equal(await withTimeout(() => Promise.resolve(7), 50), 7);
  await assert.rejects(withTimeout(() => Promise.reject(new Error("boom")), 50), /boom/);
  await assert.rejects(withTimeout(() => { throw new Error("sync"); }, 50), /sync/);
});

test("fetchRetry recovers when the first attempts hang (the Tokens widget stuck on loading)", async () => {
  let calls = 0;
  const run = () => (++calls < 3 ? never() : Promise.resolve({ ok: calls }));
  const r = await fetchRetry(run, { timeoutMs: 15, tries: 3, backoffMs: 1 });
  assert.deepEqual(r, { ok: 3 });
  assert.equal(calls, 3);
});

test("fetchRetry gives up with the last error after `tries`", async () => {
  let calls = 0;
  await assert.rejects(fetchRetry(() => { calls++; return Promise.reject(new Error("e" + calls)); }, { tries: 2, backoffMs: 1 }), /e2/);
  assert.equal(calls, 2);
});

test("fetchRetry stops when cancelled", async () => {
  let calls = 0;
  let stop = false;
  const p = fetchRetry(() => { calls++; stop = true; return Promise.reject(new Error("x")); }, { tries: 5, backoffMs: 1, cancelled: () => stop });
  await assert.rejects(p, Cancelled);
  assert.equal(calls, 1);
});

test("Tokens is not gated on the shared analytics poll (root cause of the stuck 'loading…')", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/home/widgets/registry.tsx", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("  tokens: {"), src.indexOf("  host: {"));
  assert.match(block, /dataSource: null/);
  assert.doesNotMatch(block, /dataSource: "analytics"/);
});

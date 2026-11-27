import assert from "node:assert/strict";
import test from "node:test";

import { BOARDS_DESKTOP_PATH, createBoardContributions } from "../src/desktop/contract.ts";
import { createDesktopHomeHost } from "../src/desktop/host.ts";

test("Boards register a Desktop page, a sidebar row and a palette command", () => {
  const navs = [];
  const cs = createBoardContributions(() => null, (p) => navs.push(p), { boards: "Boards", open: "Open boards" });
  assert.deepEqual(cs.map((c) => [c.area, c.data.path ?? c.data.id]), [
    ["routes", BOARDS_DESKTOP_PATH],
    ["sidebar.nav", BOARDS_DESKTOP_PATH],
    ["palette", "boards.open"],
  ]);
  assert.equal(cs[1].data.label, "Boards");
  cs[2].data.run();
  assert.deepEqual(navs, ["/boards"]);
});

test("Desktop host exposes the board doors through supported SDK verbs only", async () => {
  const calls = [];
  const ctx = { rest: async () => ({}) };
  const desktop = {
    status: async () => ({}), logs: async () => ({}), onEvent: () => () => {},
    navigate: (p) => calls.push(["navigate", p]),
    newChat: () => calls.push(["newChat"]),
    composer: { setDraft: async (sid, text) => { calls.push(["setDraft", sid, text]); return true; }, focus: (sid) => calls.push(["focus", sid]) },
    request: async (method, params) => { calls.push(["request", method, params]); return { session_id: "rt1" }; },
  };
  const host = createDesktopHomeHost(ctx, desktop, { SandboxedFrame: "FRAME" });
  host.openBoard("k3x9p2qa");
  host.openBoard(null);
  assert.deepEqual(calls.slice(0, 2), [["navigate", "/boards?id=k3x9p2qa"], ["navigate", "/boards"]]);
  assert.equal(await host.newChatWithDraft("hello [board:k3x9p2qa]", { settleMs: 0 }), true);
  assert.deepEqual(calls.slice(2, 4), [["newChat"], ["setDraft", "new", "hello [board:k3x9p2qa]"]]);
  assert.deepEqual(await host.rpc("session.create", {}), { session_id: "rt1" });
  assert.equal(host.SandboxedFrame, "FRAME");
});

test("Older Desktop builds without the doors fall back cleanly", async () => {
  const host = createDesktopHomeHost({ rest: async () => ({}) }, { status: async () => ({}), logs: async () => ({}), navigate: () => {}, onEvent: () => () => {} });
  assert.equal(host.rpc, undefined);
  assert.equal(await host.newChatWithDraft("x", { settleMs: 0 }), false);
});

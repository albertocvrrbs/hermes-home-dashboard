import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopHomeHost } from "../src/desktop/host.ts";

test("Desktop host routes widget data, layout persistence, and navigation through supported doors", async () => {
  const calls = [];
  const ctx = {
    rest: async (path, options = {}) => {
      calls.push(["rest", path, options]);
      return { source: path };
    },
  };
  const desktop = {
    status: async () => ({ version: "desktop" }),
    logs: async (params) => ({ file: params.file ?? "agent", lines: [] }),
    navigate: (path) => calls.push(["navigate", path]),
  };
  const adapter = createDesktopHomeHost(ctx, desktop);

  assert.deepEqual(await adapter.api.getStatus(), { version: "desktop" });
  assert.deepEqual(await adapter.api.getSystemStats(), { source: "/system" });
  assert.deepEqual(await adapter.api.getAnalytics(7), { source: "/analytics?days=7" });
  assert.deepEqual(await adapter.api.getCronJobs(), { source: "/cron" });
  assert.deepEqual(await adapter.api.getSessions(9, 3), { source: "/sessions?limit=9&offset=3" });
  assert.deepEqual(await adapter.api.getLogs({ file: "errors", lines: 20 }), { file: "errors", lines: [] });

  await adapter.fetchJSON("/api/plugins/home-dashboard/layout", {
    method: "PUT",
    body: JSON.stringify({ layout: { version: 1, widgets: [] } }),
  });
  adapter.navigateTo("/system");

  assert.deepEqual(calls.at(-2), [
    "rest",
    "/layout",
    { method: "PUT", body: { layout: { version: 1, widgets: [] } } },
  ]);
  assert.deepEqual(calls.at(-1), ["navigate", "/command-center?section=system"]);
});

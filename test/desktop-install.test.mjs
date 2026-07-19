import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { installDesktopPlugin } from "../scripts/install-desktop.mjs";

test("Desktop installer routes the bundled plugin into Hermes' runtime directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-home-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const repoRoot = path.join(root, "repo");
  const hermesHome = path.join(root, "hermes");
  await mkdir(path.join(repoRoot, "desktop"), { recursive: true });
  await writeFile(path.join(repoRoot, "desktop", "plugin.js"), "export default {};\n");

  const result = await installDesktopPlugin({ repoRoot, hermesHome });
  const installed = path.join(hermesHome, "desktop-plugins", "home-dashboard", "plugin.js");

  assert.equal(await readFile(installed, "utf8"), "export default {};\n");
  assert.equal(result.destination, path.dirname(installed));
  assert.equal(result.status, "linked");
});

test("Desktop installer preserves an existing manual plugin before linking the checkout", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-home-replace-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const repoRoot = path.join(root, "repo");
  const hermesHome = path.join(root, "hermes");
  const destination = path.join(hermesHome, "desktop-plugins", "home-dashboard");
  await mkdir(path.join(repoRoot, "desktop"), { recursive: true });
  await writeFile(path.join(repoRoot, "desktop", "plugin.js"), "export const version = 2;\n");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "archivo.js"), "manual copy\n");

  const result = await installDesktopPlugin({ repoRoot, hermesHome });

  assert.equal(await readFile(path.join(destination, "plugin.js"), "utf8"), "export const version = 2;\n");
  assert.ok(result.backup);
  assert.equal(await readFile(path.join(result.backup, "archivo.js"), "utf8"), "manual copy\n");
});

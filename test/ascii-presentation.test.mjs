import assert from "node:assert/strict";
import test from "node:test";

import { asciiArtClass } from "../src/home/widgets/ascii-presentation.ts";

test("only the caduceus receives the narrower aspect-ratio treatment", () => {
  assert.equal(asciiArtClass("caduceus"), "home-ascii home-ascii-caduceus");
  assert.equal(asciiArtClass("pyramid"), "home-ascii");
  assert.equal(asciiArtClass("diamond"), "home-ascii");
});

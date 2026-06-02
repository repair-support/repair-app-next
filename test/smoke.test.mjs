import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("required implementation files exist", async () => {
  const constants = await readFile(new URL("../lib/constants.ts", import.meta.url), "utf8");
  assert.match(constants, /青森店/);
  assert.match(constants, /QR更新トークン/);
});

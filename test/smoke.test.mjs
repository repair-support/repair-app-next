import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const sourceDirs = ["app", "components", "lib"];
const mojibakePattern = /繝|蜿|縺|逅|譁|蠎|荳|邂|隱|霑/;

async function sourceFiles(dir) {
  const current = new URL(`${dir}/`, root);
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [relative] : [];
  }));
  return files.flat();
}

test("required implementation constants are readable Japanese", async () => {
  const constants = await readFile(new URL("../lib/constants.ts", import.meta.url), "utf8");
  assert.match(constants, /青森店/);
  assert.match(constants, /QR更新トークン/);
  assert.match(constants, /受付中/);
});

test("source files do not contain common mojibake markers", async () => {
  const files = (await Promise.all(sourceDirs.map(sourceFiles))).flat();
  for (const file of files) {
    const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(content, mojibakePattern, file);
  }
});

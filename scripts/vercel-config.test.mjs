import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));

describe("root vercel.json", () => {
  it("keeps a single repo-root static config and selects the app at build time", () => {
    assert.equal(vercel.framework, null);
    assert.equal(vercel.installCommand, "npm ci");
    assert.equal(vercel.buildCommand, "node scripts/vercel-build.mjs");
    assert.equal(vercel.outputDirectory, "vercel-output");
    assert.equal(vercel.rewrites.length, 1);
    assert.match(vercel.rewrites[0].source, /api\//);
    assert.match(vercel.rewrites[0].source, /assets\//);
    assert.equal(vercel.rewrites[0].destination, "/index.html");
  });

  it("does not add serverless functions or an API rewrite to FastAPI", () => {
    assert.equal(vercel.functions, undefined);
    assert.equal(vercel.rewrites.some((rule) => /localhost|8000/.test(JSON.stringify(rule))), false);
  });
});

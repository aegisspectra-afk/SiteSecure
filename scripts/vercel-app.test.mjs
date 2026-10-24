import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveVercelApp, VERCEL_APPS, VERCEL_OUTPUT_DIR } from "./vercel-app.mjs";

describe("Vercel app selector", () => {
  it("defaults to SITE SECURE web when the project env is unset", () => {
    assert.deepEqual(resolveVercelApp(undefined), { name: "web", ...VERCEL_APPS.web });
    assert.deepEqual(resolveVercelApp(""), { name: "web", ...VERCEL_APPS.web });
    assert.deepEqual(resolveVercelApp("  "), { name: "web", ...VERCEL_APPS.web });
  });

  it("selects WorkForce and SSP without changing the web mapping", () => {
    assert.equal(resolveVercelApp("workforce").distDir, "apps/WorkForce/dist");
    assert.equal(resolveVercelApp("WorkForce").npmScript, "workforce:build");
    assert.equal(resolveVercelApp("ssp").distDir, "apps/ssp/dist");
    assert.equal(VERCEL_APPS.web.npmScript, "web:build");
    assert.equal(VERCEL_OUTPUT_DIR, "vercel-output");
  });

  it("rejects unknown app names instead of silently building web", () => {
    assert.throws(() => resolveVercelApp("api"), /SITESECURE_VERCEL_APP/);
    assert.throws(() => resolveVercelApp("Work Force"), /SITESECURE_VERCEL_APP/);
  });
});

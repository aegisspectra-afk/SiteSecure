/**
 * Focused B2.1b/c smoke (vitest blocked on Windows paths containing `&`).
 * Run: node node_modules/vite-node/vite-node.mjs --script scripts/smoke-entitlement-revoke.mts
 */
import { ApiClientError } from "@site-secure/api-client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  isFeatureNotIncludedError,
  isProductAvailable,
  productIdForPath,
  shouldReturnToPlatformHome,
} from "../src/lib/entitlement-revoke.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(
  isFeatureNotIncludedError(new ApiClientError(403, "FEATURE_NOT_INCLUDED", "no")),
  "FEATURE_NOT_INCLUDED detected",
);
assert(
  !isFeatureNotIncludedError(new ApiClientError(403, "PERMISSION_DENIED", "no")),
  "other 403 ignored",
);
assert(!isFeatureNotIncludedError(new Error("x")), "non-ApiClientError ignored");

assert(productIdForPath("/app/ssp/forms/1") === "ssp", "ssp path");
assert(productIdForPath("/app/fleet") === "fleet", "fleet path");
assert(productIdForPath("/app/today") === "site_secure", "ss path");
assert(productIdForPath("/platform") === null, "platform ignored");
assert(productIdForPath("/admin/users") === null, "admin ignored");

assert(isProductAvailable("ssp", ["ssp"]), "ssp available");
assert(!isProductAvailable("ssp", ["core"]), "ssp unavailable");
assert(isProductAvailable("site_secure", ["quotes"]), "ss available");
assert(!isProductAvailable("site_secure", ["ssp"]), "ss unavailable");

assert(shouldReturnToPlatformHome("/app/ssp", ["core"]) === true, "navigate when ssp gone");
assert(shouldReturnToPlatformHome("/app/ssp", ["ssp"]) === false, "stay when ssp present");
assert(shouldReturnToPlatformHome("/platform", []) === false, "no nav from platform");
assert(shouldReturnToPlatformHome("/admin", []) === false, "no nav from admin");

const here = dirname(fileURLToPath(import.meta.url));
const platformSrc = readFileSync(join(here, "../src/routes/platform/index.tsx"), "utf8");
assert(platformSrc.includes("refetchOnWindowFocus: true"), "B2.1c flag present");

const rootSrc = readFileSync(join(here, "../src/routes/__root.tsx"), "utf8");
assert(rootSrc.includes("EntitlementRevokeBridge"), "bridge wired in root");

const qcSrc = readFileSync(join(here, "../src/lib/query-client.ts"), "utf8");
assert(qcSrc.includes("MutationCache"), "query-client caches configured");
assert(qcSrc.includes("notifyFeatureNotIncluded"), "FEATURE_NOT_INCLUDED notify wired");

console.log("entitlement-revoke smoke OK (B2.1b helpers + B2.1c wiring)");

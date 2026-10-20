import { afterAuthPath } from "../src/lib/auth-routes";
import { homeVariant } from "../src/lib/home";
import { he } from "../src/i18n/he";

const checks: Array<[unknown, unknown]> = [
  [afterAuthPath(true), "/platform"],
  [afterAuthPath(false), "/onboarding"],
  [afterAuthPath(true, "/invite/abcdefghijklmnop"), "/invite/abcdefghijklmnop"],
  [homeVariant("technician"), "today"],
  [homeVariant("owner"), "ops"],
];

for (const [actual, expected] of checks) {
  if (actual !== expected) {
    console.error("FAIL", { actual, expected });
    process.exit(1);
  }
}

if (!he.platformHomeEmptyBody.includes("מנהל")) {
  console.error("FAIL empty-state copy");
  process.exit(1);
}

console.log(`client-smoke OK (${checks.length} checks)`);

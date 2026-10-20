/**
 * SSP unified product smoke (no browser, no DB).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "../..");

const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
  name: string;
  dependencies?: Record<string, string>;
};
assert(pkg.name === "@aegis/ssp", "package name");

const routerSrc = readFileSync(join(appRoot, "src/router.tsx"), "utf8");
assert(routerSrc.includes('path: "/login"'), "login route");
assert(routerSrc.includes("DashboardPage"), "dashboard home");
assert(routerSrc.includes('path: "/forms"'), "forms section");
assert(routerSrc.includes('path: "/forms/$formId"'), "form detail");
assert(routerSrc.includes('path: "/sites"'), "sites list");
assert(routerSrc.includes('path: "/sites/$siteId"'), "site detail");
assert(routerSrc.includes('path: "/activate"'), "field activate");
assert(routerSrc.includes('path: "/field"'), "field home");
assert(routerSrc.includes('path: "/field/forms/$assignmentId"'), "field form");
assert(routerSrc.includes('path: "/enrollments"'), "enrollments");
assert(routerSrc.includes("ActivatePage"), "activate page");
assert(routerSrc.includes("FieldHomePage"), "field home page");
assert(routerSrc.includes("EnrollmentsPage"), "enrollments page");
assert(routerSrc.includes('path: "/patrols"'), "patrols");
assert(routerSrc.includes('path: "/patrols/runs/$runId"'), "run detail");
assert(routerSrc.includes('path: "/checkpoints"'), "checkpoints");
assert(routerSrc.includes('path: "/checkpoints/$checkpointId/print"'), "checkpoint print");
assert(routerSrc.includes('path: "/checkpoints/print"'), "checkpoint print sheet");
assert(routerSrc.includes('path: "/scan"'), "mobile scan");
assert(existsSync(join(appRoot, "src/lib/cameraQr.ts")), "camera qr helper");
assert(existsSync(join(appRoot, "src/lib/printCheckpoints.ts")), "print helper");
assert(existsSync(join(appRoot, "src/components/QrScanner.tsx")), "qr scanner");
assert(routerSrc.includes('path: "/events"'), "events");
assert(routerSrc.includes('path: "/events/$eventId"'), "event detail");
assert(routerSrc.includes('path: "/distributions"'), "distributions");
assert(routerSrc.includes('path: "/officers"'), "officers");
assert(routerSrc.includes('path: "/organization"'), "organization");
assert(routerSrc.includes('path: "/settings"'), "settings");
assert(routerSrc.includes('path: "/activity"'), "last 24h activity");
assert(routerSrc.includes('path: "/alerts"'), "alerts");
assert(routerSrc.includes('path: "/users"'), "users");
assert(routerSrc.includes('path: "/messages"'), "messages");
assert(routerSrc.includes('path: "/mobility"'), "mobility");
assert(routerSrc.includes('path: "/task-templates"'), "task templates");
assert(routerSrc.includes('path: "/templates"'), "templates hub");
assert(routerSrc.includes('path: "/devices"'), "linked devices");
assert(!/ezguard/i.test(routerSrc), "no EZGuard in router");
assert(existsSync(join(repoRoot, "supabase/migrations/20261019240000_ssp_ops_workflow_c2.sql")), "c2 migration");
assert(
  existsSync(join(repoRoot, "supabase/migrations/20261020120000_ssp_sites_and_form_assignments.sql")),
  "sites assignment migration",
);
assert(
  existsSync(join(repoRoot, "supabase/migrations/20261020140000_ssp_site_activation.sql")),
  "site activation migration",
);
assert(existsSync(join(repoRoot, "apps/api/app/ssp/activation_codes.py")), "activation helpers");
assert(existsSync(join(repoRoot, "apps/api/app/routers/public_ssp_site.py")), "public site activate");
assert(existsSync(join(repoRoot, "apps/api/app/routers/ssp_site_activation.py")), "manager activation");
assert(existsSync(join(appRoot, "src/lib/deviceSession.ts")), "device session cache");
assert(existsSync(join(appRoot, "src/routes/ActivatePage.tsx")), "activate ui");
assert(existsSync(join(appRoot, "src/routes/FieldHomePage.tsx")), "field home ui");
assert(existsSync(join(appRoot, "src/routes/FieldFormPage.tsx")), "field form ui");
assert(existsSync(join(appRoot, "src/routes/EnrollmentsPage.tsx")), "enrollments ui");
assert(existsSync(join(appRoot, "src/components/SiteActivationPanel.tsx")), "site activation panel");
assert(existsSync(join(repoRoot, "apps/api/app/ssp/run_lifecycle.py")), "run lifecycle module");

const shell = readFileSync(join(appRoot, "src/components/SspShell.tsx"), "utf8");
assert(shell.includes("navOpsCenter"), "ops center nav");
assert(shell.includes("navWork"), "work nav");
assert(shell.includes("navUsers"), "users nav");
assert(shell.includes("navMessages"), "messages nav");
assert(shell.includes("navMobility"), "mobility nav");
assert(shell.includes("navPatrolsMain"), "patrols nav");
assert(shell.includes("navEventsHub"), "events hub nav");
assert(shell.includes("navTemplatesHub"), "templates hub nav");
assert(shell.includes("/templates"), "templates path");
assert(shell.includes("/activity"), "activity nav");
assert(!shell.includes("/enrollments"), "enrollments not primary");
assert(!/ezguard/i.test(shell), "no EZGuard in shell");

const he = readFileSync(join(appRoot, "src/i18n/he.ts"), "utf8");
assert(he.includes('brand: "SSP"'), "product brand SSP");
assert(he.includes("issueActivationCode"), "activation copy");
assert(he.includes("loginFieldLink"), "field login link copy");
assert(!/ezguard/i.test(he), "no EZGuard in copy");

const layout = readFileSync(join(appRoot, "src/routes/AuthenticatedLayout.tsx"), "utf8");
assert(layout.includes("hasSsp"), "entitlement gate");
assert(layout.includes("OrgProvider"), "org provider");
assert(layout.includes("RequireSspAccess"), "ssp access gate");

assert(existsSync(join(repoRoot, "supabase/migrations/20261019230000_ssp_operations_core.sql")), "ops migration");
assert(existsSync(join(repoRoot, "apps/api/app/routers/ssp_ops.py")), "ops router");
assert(existsSync(join(repoRoot, "apps/web/src/routes/app/ssp/route.tsx")), "embedded SSP preserved");
assert(existsSync(join(repoRoot, "apps/api/app/routers/public_ssp.py")), "public_ssp preserved");

const { can, hasFeature } = await import("../src/lib/can.ts");
assert(hasFeature(["ssp"], "ssp") === true, "hasFeature");
assert(can("viewer", "ssp.forms.view", ["ssp"], ["ssp.forms.view"]) === true, "can");

const { productCan } = await import("../src/lib/productAuthz.ts");
assert(productCan("patrol_manager", "ssp.patrols.edit") === true, "manager patrols");
assert(productCan("patrol_officer", "ssp.patrols.edit") === false, "officer no edit patrols");
assert(productCan("patrol_officer", "ssp.scans.create") === true, "officer scan");
assert(productCan("patrol_manager", "ssp.sites.edit") === true, "manager sites");
assert(productCan("patrol_officer", "ssp.sites.edit") === false, "officer no site edit");
assert(productCan("patrol_officer", "ssp.sites.view") === true, "officer site view");

await import("./ssp-c3-unit.mts");

console.log("ssp-unified smoke OK");

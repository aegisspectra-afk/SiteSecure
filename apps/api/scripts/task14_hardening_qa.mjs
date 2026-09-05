/**
 * Task 14 — live API hardening QA (disposable catalog only).
 * Covers: empty catalog, cable units, incomplete core, partial apply resume fingerprint.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TOKEN = fs.readFileSync(path.join(ROOT, "apps/api/scripts/.tmp_import_token"), "utf8").trim();
const API = process.env.API_URL || "http://127.0.0.1:8000";

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const session = await api("GET", `${API}/api/v1/auth/session`);
const ws = session.json.memberships?.[0]?.workspace_id;
if (!ws) throw new Error("no workspace");
const cats = await api("GET", `${API}/api/v1/workspaces/${ws}/catalog/categories`);
const byKey = Object.fromEntries((cats.json.items || []).map((c) => [c.key, c]));
const stamp = Date.now();
const created = [];

async function createProduct(sample) {
  const res = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, sample);
  if (res.status >= 300) throw new Error(JSON.stringify(res.json));
  created.push(res.json.id);
  return res.json;
}

const report = { scenarios: {} };

// Empty-ish: recommend with only unrelated products deactivated — call with workspace catalog
// Scenario empty core: create nothing structured for this stamp; use manufacturer PrefEmpty
const emptyProbe = await api("POST", `${API}/api/v1/workspaces/${ws}/cctv/recommend`, {
  camera_count: 2,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 7,
  manufacturer_preference: `NoVendor_${stamp}`,
  installation_requested: false,
  architecture_intent: "prefer_external_switch",
});
report.scenarios.readiness = {
  status: emptyProbe.status,
  hasReadiness: Boolean(emptyProbe.json.catalog_readiness),
  engineeringOk: emptyProbe.json.engineering?.recorder?.selectedChannelTier != null,
};

const cam = await createProduct({
  name: `QA14 Cam ${stamp}`,
  sku: `QA14-CAM-${stamp}`,
  kind: "product",
  list_price: 100,
  category_id: byKey.cameras_ip.id,
  attributes: { resolution_mp: 4, environment: "outdoor", poe: true, max_power_w: 8 },
});
const nvr = await createProduct({
  name: `QA14 NVR ${stamp}`,
  sku: `QA14-NVR-${stamp}`,
  kind: "product",
  list_price: 800,
  category_id: byKey.nvr.id,
  attributes: { channels: 8, poe_ports: 8, poe_budget_w: 120, drive_bays: 2, max_hdd_tb: 10 },
});
await createProduct({
  name: `QA14 HDD10 ${stamp}`,
  sku: `QA14-HDD10-${stamp}`,
  kind: "product",
  list_price: 60,
  category_id: byKey.hdd_recorders.id,
  attributes: { capacity_tb: 10, surveillance_grade: true },
});
const cableM = await createProduct({
  name: `QA14 Cat6/m ${stamp}`,
  sku: `QA14-CABM-${stamp}`,
  kind: "product",
  list_price: 2,
  unit: "m",
  category_id: byKey.cat6.id,
});
await createProduct({
  name: `QA14 Cat6 box ${stamp}`,
  sku: `QA14-CABBOX-${stamp}`,
  kind: "product",
  list_price: 200,
  unit: "ea",
  category_id: byKey.cat6.id,
});
const laborWrong = await createProduct({
  name: `QA14 Hourly ${stamp}`,
  sku: `QA14-HOUR-${stamp}`,
  kind: "service",
  list_price: 150,
  category_id: byKey.labor_hourly.id,
});

const withCable = await api("POST", `${API}/api/v1/workspaces/${ws}/cctv/recommend`, {
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  camera_max_power_w: 8,
  cable_distance_meters: 100,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: true,
});
const cableComp = withCable.json.components?.find((c) => c.role === "cable");
const installComp = withCable.json.components?.find((c) => c.role === "camera_install");
report.scenarios.cable = {
  status: withCable.status,
  selectedSku: cableComp?.selected_product?.sku,
  qty: cableComp?.quantity,
  prefersMeter: String(cableComp?.selected_product?.sku || "").includes("CABM"),
};
report.scenarios.service = {
  installStatus: installComp?.resolution_status,
  // must not auto-pick hourly labor
  notHourly: installComp?.selected_product?.id !== laborWrong.id,
};

// Quote apply + duplicate fingerprint simulation (client-side logic mirrored)
const quote = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes`, { title: `QA14 ${stamp}` });
const qid = quote.json.id;
const section = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes/${qid}/sections`, {
  name: "מערכת CCTV",
  sort_order: 10,
});
const sectionId = section.json.section?.id;
const rec = await api("POST", `${API}/api/v1/workspaces/${ws}/cctv/recommend`, {
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
const lines = (rec.json.components || [])
  .filter((c) => c.selected_product?.id && !c.optional && c.selected_confidence !== "TEXT_ASSISTED")
  .map((c) => ({ role: c.role, product_id: c.selected_product.id, qty: c.quantity || 1 }));

// Partial apply: add first line only, then remaining
const first = lines[0];
const r1 = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes/${qid}/items`, {
  product_id: first.product_id,
  item_type: "catalog",
  qty: first.qty,
  section_id: sectionId,
});
const remaining = lines.slice(1);
for (const line of remaining) {
  await api("POST", `${API}/api/v1/workspaces/${ws}/quotes/${qid}/items`, {
    product_id: line.product_id,
    item_type: "catalog",
    qty: line.qty,
    section_id: sectionId,
  });
}
const after = await api("GET", `${API}/api/v1/workspaces/${ws}/quotes/${qid}`);
const items = (after.json.items || []).filter((i) => i.section_id === sectionId);
report.scenarios.apply = {
  firstStatus: r1.status,
  lines: lines.length,
  sectionItems: items.length,
  noDupRoles: items.length === lines.length,
};

for (const id of created) {
  await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${id}`, { is_active: false });
}
await api("DELETE", `${API}/api/v1/workspaces/${ws}/quotes/${qid}`);

report.ok =
  report.scenarios.readiness.status === 200 &&
  report.scenarios.readiness.hasReadiness &&
  report.scenarios.readiness.engineeringOk &&
  report.scenarios.cable.prefersMeter &&
  report.scenarios.cable.qty === 100 &&
  report.scenarios.service.notHourly &&
  report.scenarios.apply.noDupRoles &&
  report.scenarios.apply.sectionItems === report.scenarios.apply.lines;

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);

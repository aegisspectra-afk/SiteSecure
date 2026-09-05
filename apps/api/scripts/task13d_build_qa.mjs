/**
 * Task 13D — live recommend + quote projection QA (disposable catalog + quote).
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

// Deactivate leftover prior QA NVRs so Scenario C is deterministic
const prior = await api("GET", `${API}/api/v1/workspaces/${ws}/catalog/products?q=QA13&limit=100`);
for (const p of prior.json.items || []) {
  if (/QA13[CD]-NVR/i.test(p.sku || p.name || "")) {
    await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${p.id}`, { is_active: false });
  }
}

async function createProduct(sample) {
  const res = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, sample);
  if (res.status >= 300) throw new Error(JSON.stringify(res.json));
  created.push(res.json.id);
  return res.json;
}

const cam4 = await createProduct({
  name: `QA13D Cam4 ${stamp}`,
  sku: `QA13D-CAM4-${stamp}`,
  kind: "product",
  list_price: 100,
  category_id: byKey.cameras_ip.id,
  manufacturer: "QABrand",
  attributes: { resolution_mp: 4, environment: "outdoor", form_factor: "bullet", poe: true, max_power_w: 8 },
});
await createProduct({
  name: `QA13D Cam8 ${stamp}`,
  sku: `QA13D-CAM8-${stamp}`,
  kind: "product",
  list_price: 180,
  category_id: byKey.cameras_ip.id,
  manufacturer: "QABrand",
  attributes: { resolution_mp: 8, environment: "outdoor", poe: true, max_power_w: 12 },
});
const nvr = await createProduct({
  name: `QA13D NVR16 ${stamp}`,
  sku: `QA13D-NVR-${stamp}`,
  kind: "product",
  list_price: 900,
  category_id: byKey.nvr.id,
  manufacturer: "QABrand",
  attributes: { channels: 16, poe_ports: 16, poe_budget_w: 200, drive_bays: 4, max_hdd_tb: 12 },
});
for (const tb of [8, 10, 12]) {
  await createProduct({
    name: `QA13D HDD ${tb}T ${stamp}`,
    sku: `QA13D-HDD${tb}-${stamp}`,
    kind: "product",
    list_price: 50 + tb,
    category_id: byKey.hdd_recorders.id,
    attributes: { capacity_tb: tb, surveillance_grade: true },
  });
}
await createProduct({
  name: `QA13D SW16 ${stamp}`,
  sku: `QA13D-SW-${stamp}`,
  kind: "product",
  list_price: 400,
  category_id: byKey.switch.id,
  attributes: { ports: 16, poe_ports: 16, poe_budget_w: 180 },
});

const report = { workspace: ws, scenarios: {}, apply: null };

async function recommend(body) {
  return api("POST", `${API}/api/v1/workspaces/${ws}/cctv/recommend`, body);
}

// A
const a = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  recording_mode: "continuous",
  poe_required: true,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
report.scenarios.A = {
  status: a.status,
  recStatus: a.json.status,
  blocking: a.json.blocking,
  camera: a.json.components?.find((c) => c.role === "camera")?.selected_product?.sku,
  recorder: a.json.components?.find((c) => c.role === "recorder")?.selected_product?.sku,
  examined: a.json.catalog_stats?.products_examined,
};

// B
const b = await recommend({
  camera_count: 12,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 30,
  recording_mode: "continuous",
  expansion_headroom: 0.2,
  poe_required: true,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
report.scenarios.B = {
  status: b.status,
  tier: b.json.engineering?.recorder?.selectedChannelTier,
  storageTb: b.json.engineering?.storage?.requiredTbWithOverhead,
  externalSwitch: b.json.engineering?.poeArchitecture?.externalSwitchRequired,
  cameraIs4mp: String(b.json.components?.find((c) => c.role === "camera")?.selected_product?.sku || "").includes(
    "CAM4",
  ),
  hddQty: b.json.components?.find((c) => c.role === "storage")?.quantity,
};

// C — incomplete NVR (deactivate structured recorder)
await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${nvr.id}`, { is_active: false });
const c = await recommend({
  camera_count: 12,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 30,
  expansion_headroom: 0.2,
  camera_max_power_w: 8,
  architecture_intent: "prefer_external_switch",
  installation_requested: false,
});
report.scenarios.C = {
  recorderStatus: c.json.components?.find((x) => x.role === "recorder")?.resolution_status,
  blocking: c.json.blocking,
  cameraOk: c.json.components?.find((x) => x.role === "camera")?.resolution_status,
};

// restore NVR
await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${nvr.id}`, {
  is_active: true,
  attributes: { channels: 16, poe_ports: 16, poe_budget_w: 200, drive_bays: 4, max_hdd_tb: 12 },
});

// D — no cable meters
const d = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
report.scenarios.D = {
  blocking: d.json.blocking,
  cable: d.json.components?.find((x) => x.role === "cable")?.resolution_status,
};

// E — preferred vendor fails
const e = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  camera_max_power_w: 8,
  manufacturer_preference: "PrefGhost",
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
report.scenarios.E = {
  cameraMfr: e.json.components?.find((x) => x.role === "camera")?.selected_product?.manufacturer,
  warnings: (e.json.warnings || []).map((w) => w.code),
};

// Quote apply from B-like recommendation
const quote = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes`, {
  title: `QA13D Build ${stamp}`,
});
if (quote.status >= 300) throw new Error(JSON.stringify(quote.json));
const quoteId = quote.json.id;
const section = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}/sections`, {
  name: "מערכת CCTV",
  sort_order: 10,
});
const sectionId =
  section.json.section?.id ??
  section.json.sections?.find((s) => (s.name || "").includes("CCTV"))?.id ??
  section.json.sections?.[section.json.sections.length - 1]?.id;
if (!sectionId) throw new Error(`no section id: ${JSON.stringify(section.json)}`);
const applyRec = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
  installation_requested: false,
});
const lines = (applyRec.json.components || [])
  .filter((c) => c.selected_product?.id && c.selected_confidence !== "TEXT_ASSISTED" && !c.optional)
  .map((c) => ({ role: c.role, product_id: c.selected_product.id, qty: c.quantity || 1 }));

const itemResults = [];
for (const line of lines) {
  const row = await api("POST", `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}/items`, {
    product_id: line.product_id,
    item_type: "catalog",
    qty: line.qty,
    section_id: sectionId,
  });
  itemResults.push({ status: row.status, err: row.status >= 300 ? row.json : null, count: row.json.items?.length });
  if (row.status >= 300) throw new Error(JSON.stringify(row.json));
}
const after = await api("GET", `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`);
const items = after.json.items || [];
const sectionItems = items.filter((i) => i.section_id === sectionId);
report.apply = {
  quoteId,
  sectionId,
  sectionCreateStatus: section.status,
  itemResults,
  linesRequested: lines.length,
  allItems: items.length,
  sectionItems: sectionItems.length,
  cameraQty:
    sectionItems.find((i) => i.product_id === cam4.id)?.qty ??
    items.find((i) => String(i.sku || "").includes("CAM4"))?.qty ??
    items.find((i) => Number(i.qty) === 4 && i.section_id === sectionId)?.qty,
  total: after.json.total,
  pricesFromServer: items.every((i) => typeof i.unit_price === "number"),
  snapshotOk: items.every((i) => i.catalog_snapshot && Object.keys(i.catalog_snapshot).length > 0),
};

// cleanup products + soft-delete quote if supported
for (const id of created) {
  await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${id}`, { is_active: false });
}
await api("DELETE", `${API}/api/v1/workspaces/${ws}/quotes/${quoteId}`);

report.ok =
  a.status === 200 &&
  report.scenarios.A.recStatus === "OK" &&
  report.scenarios.B.tier === 16 &&
  report.scenarios.B.cameraIs4mp &&
  report.scenarios.B.externalSwitch === false &&
  report.scenarios.C.recorderStatus === "UNRESOLVED" &&
  report.scenarios.C.blocking === true &&
  report.scenarios.D.blocking === false &&
  report.scenarios.D.cable === "UNRESOLVED" &&
  report.scenarios.E.warnings.includes("PREFERRED_MANUFACTURER_UNAVAILABLE") &&
  report.apply.allItems === report.apply.linesRequested &&
  report.apply.cameraQty === 4 || report.apply.cameraQty === "4"
  report.apply.pricesFromServer &&
  report.apply.snapshotOk;

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);

/**
 * Task 13C — live CCTV recommend QA with disposable structured catalog products.
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

const cam4 = await createProduct({
  name: `QA13C Cam4 ${stamp}`,
  sku: `QA13C-CAM4-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: byKey.cameras_ip.id,
  manufacturer: "QABrand",
  attributes: { resolution_mp: 4, environment: "outdoor", form_factor: "bullet", poe: true, max_power_w: 8 },
});
const cam8 = await createProduct({
  name: `QA13C Cam8 ${stamp}`,
  sku: `QA13C-CAM8-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: byKey.cameras_ip.id,
  manufacturer: "QABrand",
  attributes: { resolution_mp: 8, environment: "outdoor", form_factor: "bullet", poe: true, max_power_w: 12 },
});
const nvr = await createProduct({
  name: `QA13C NVR16 ${stamp}`,
  sku: `QA13C-NVR-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: byKey.nvr.id,
  manufacturer: "QABrand",
  attributes: { channels: 16, poe_ports: 16, poe_budget_w: 200, drive_bays: 4, max_hdd_tb: 12 },
});
for (const tb of [8, 10, 12]) {
  await createProduct({
    name: `QA13C HDD ${tb}T ${stamp}`,
    sku: `QA13C-HDD${tb}-${stamp}`,
    kind: "product",
    list_price: 1,
    category_id: byKey.hdd_recorders.id,
    attributes: { capacity_tb: tb, surveillance_grade: true },
  });
}
await createProduct({
  name: `QA13C SW16 ${stamp}`,
  sku: `QA13C-SW-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: byKey.switch.id,
  attributes: { ports: 16, poe_ports: 16, poe_budget_w: 180 },
});

const report = { workspace: ws, scenarios: {} };

async function recommend(body) {
  return api("POST", `${API}/api/v1/workspaces/${ws}/cctv/recommend`, body);
}

// A: 4 cams / 14 days
const a = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  recording_mode: "continuous",
  poe_required: true,
  camera_max_power_w: 8,
  architecture_intent: "prefer_nvr_integrated",
});
report.scenarios.A = {
  status: a.status,
  recStatus: a.json.status,
  camera: a.json.components?.find((c) => c.role === "camera")?.selected_product?.sku,
  recorder: a.json.components?.find((c) => c.role === "recorder")?.selected_product?.sku,
  blocking: a.json.blocking,
  examined: a.json.catalog_stats?.products_examined,
};

// B: 12 cams / 30d / 20% headroom
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
});
report.scenarios.B = {
  status: b.status,
  recStatus: b.json.status,
  tier: b.json.engineering?.recorder?.selectedChannelTier,
  storageTb: b.json.engineering?.storage?.requiredTbWithOverhead,
  hddQty: b.json.components?.find((c) => c.role === "storage")?.quantity,
  hddSku: b.json.components?.find((c) => c.role === "storage")?.selected_product?.sku,
  switch: b.json.components?.find((c) => c.role === "poe_switch")?.resolution_status ?? null,
  externalSwitchRequired: b.json.engineering?.poeArchitecture?.externalSwitchRequired,
  cameraSku: b.json.components?.find((c) => c.role === "camera")?.selected_product?.sku,
  recorderSku: b.json.components?.find((c) => c.role === "recorder")?.selected_product?.sku,
  blocking: b.json.blocking,
};

// Prefer 4MP over 8MP
report.scenarios.B.cameraIs4mp = String(report.scenarios.B.cameraSku || "").includes("CAM4");

// C: deactivate NVR structured — patch attributes empty
await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${nvr.id}`, { attributes: {} });
const c = await recommend({
  camera_count: 12,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 30,
  recording_mode: "continuous",
  expansion_headroom: 0.2,
  camera_max_power_w: 8,
  architecture_intent: "prefer_external_switch",
});
report.scenarios.C = {
  status: c.status,
  recorderStatus: c.json.components?.find((x) => x.role === "recorder")?.resolution_status,
  cameraOk: c.json.components?.find((x) => x.role === "camera")?.resolution_status,
  blocking: c.json.blocking,
};

// D: preferred manufacturer cannot meet (ask PrefGhost)
const d = await recommend({
  camera_count: 4,
  resolution_mp: 4,
  environment: "outdoor",
  retention_days: 14,
  recording_mode: "continuous",
  camera_max_power_w: 8,
  manufacturer_preference: "PrefGhost",
  architecture_intent: "prefer_external_switch",
});
report.scenarios.D = {
  status: d.status,
  cameraMfr: d.json.components?.find((x) => x.role === "camera")?.selected_product?.manufacturer,
  warnings: (d.json.warnings || []).map((w) => w.code),
};

// restore nvr attrs then deactivate all QA products
await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${nvr.id}`, {
  attributes: { channels: 16, poe_ports: 16, poe_budget_w: 200, drive_bays: 4, max_hdd_tb: 12 },
});
for (const id of created) {
  await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${id}`, { is_active: false });
}

report.ok =
  a.status === 200 &&
  b.status === 200 &&
  report.scenarios.B.tier === 16 &&
  report.scenarios.B.cameraIs4mp &&
  report.scenarios.B.externalSwitchRequired === false &&
  report.scenarios.B.switch == null &&
  String(report.scenarios.B.recorderSku || "").includes("NVR") &&
  report.scenarios.C.recorderStatus === "UNRESOLVED" &&
  report.scenarios.D.warnings.includes("PREFERRED_MANUFACTURER_UNAVAILABLE");

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);

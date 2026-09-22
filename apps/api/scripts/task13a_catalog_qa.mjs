/**
 * Task 13A — live catalog technical attributes QA (disposable products).
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
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text, status: res.status };
  }
  return { status: res.status, json };
}

const session = await api("GET", `${API}/api/v1/auth/session`);
const ws = session.json.memberships?.[0]?.workspace_id;
if (!ws) throw new Error("No workspace");

const cats = await api("GET", `${API}/api/v1/workspaces/${ws}/catalog/categories`);
const byKey = Object.fromEntries((cats.json.items || []).map((c) => [c.key, c]));

const stamp = Date.now();
const report = { workspace: ws, created: [], checks: {} };

function leaf(key) {
  const c = byKey[key];
  if (!c) throw new Error(`Missing category ${key}`);
  return c;
}

// Confirm HDD schema
const hddSchema = leaf("hdd_recorders").attribute_schema || [];
report.checks.hddSchemaHasCapacity = hddSchema.some((f) => f.key === "capacity_tb");
report.checks.hddSchemaNotCamera = !hddSchema.some((f) => f.key === "resolution_mp");

const samples = [
  {
    name: `QA 13A Camera ${stamp}`,
    sku: `QA13A-CAM-${stamp}`,
    category_id: leaf("cameras_ip").id,
    attributes: {
      resolution_mp: 4,
      environment: "outdoor",
      form_factor: "bullet",
      poe: true,
      max_power_w: 8,
      onvif: true,
    },
  },
  {
    name: `QA 13A NVR ${stamp}`,
    sku: `QA13A-NVR-${stamp}`,
    category_id: leaf("nvr").id,
    attributes: {
      channels: 16,
      poe_ports: 16,
      poe_budget_w: 200,
      drive_bays: 2,
      max_hdd_tb: 10,
    },
  },
  {
    name: `QA 13A HDD ${stamp}`,
    sku: `QA13A-HDD-${stamp}`,
    category_id: leaf("hdd_recorders").id,
    attributes: { capacity_tb: 8, surveillance_grade: true },
  },
  {
    name: `QA 13A Switch ${stamp}`,
    sku: `QA13A-SW-${stamp}`,
    category_id: leaf("switch").id,
    attributes: { ports: 16, poe_ports: 16, poe_budget_w: 180 },
  },
];

for (const sample of samples) {
  const created = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, {
    name: sample.name,
    sku: sample.sku,
    kind: "product",
    unit: "unit",
    list_price: 1,
    category_id: sample.category_id,
    attributes: sample.attributes,
  });
  report.created.push({ sku: sample.sku, status: created.status, id: created.json.id, error: created.json.error });
  if (created.status < 300 && created.json.id) {
    const got = await api("GET", `${API}/api/v1/workspaces/${ws}/catalog/products/${created.json.id}`);
    report.checks[sample.sku] = {
      reloadAttrs: got.json.attributes,
      match: JSON.stringify(got.json.attributes) === JSON.stringify(sample.attributes) ||
        Object.entries(sample.attributes).every(([k, v]) => got.json.attributes?.[k] === v),
    };
  }
}

// Reject malformed
const bad = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, {
  name: `QA 13A Bad ${stamp}`,
  sku: `QA13A-BAD-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: leaf("nvr").id,
  attributes: { channels: -4 },
});
report.checks.rejectNegativeChannels = bad.status === 400;

const badSwitch = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, {
  name: `QA 13A BadSW ${stamp}`,
  sku: `QA13A-BADSW-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: leaf("switch").id,
  attributes: { ports: 8, poe_ports: 16 },
});
report.checks.rejectPoePortsGtPorts = badSwitch.status === 400;

const emptyOk = await api("POST", `${API}/api/v1/workspaces/${ws}/catalog/products`, {
  name: `QA 13A Empty ${stamp}`,
  sku: `QA13A-EMPTY-${stamp}`,
  kind: "product",
  list_price: 1,
  category_id: leaf("cameras_ip").id,
  attributes: {},
});
report.checks.emptyAttrsOk = emptyOk.status < 300;
if (emptyOk.json.id) report.created.push({ sku: `QA13A-EMPTY-${stamp}`, status: emptyOk.status, id: emptyOk.json.id });

// Cleanup disposable products via patch is_active=false (no delete endpoint assumed)
for (const row of report.created) {
  if (!row.id) continue;
  await api("PATCH", `${API}/api/v1/workspaces/${ws}/catalog/products/${row.id}`, { is_active: false });
}

console.log(JSON.stringify(report, null, 2));
const ok =
  report.checks.hddSchemaHasCapacity &&
  report.checks.hddSchemaNotCamera &&
  report.checks.rejectNegativeChannels &&
  report.checks.rejectPoePortsGtPorts &&
  report.checks.emptyAttrsOk &&
  report.created.filter((c) => c.sku.startsWith("QA13A-CAM") || c.sku.startsWith("QA13A-NVR") || c.sku.startsWith("QA13A-HDD") || c.sku.startsWith("QA13A-SW")).every((c) => c.status < 300);
process.exit(ok ? 0 : 2);

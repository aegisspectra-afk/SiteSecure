/**
 * Q3-B Fast Quote benchmark fixtures — NON-PRODUCTION Phase1B QA workspace only.
 *
 * Idempotent: reuses products/packages/templates by synthetic SKU / name prefix "QA ".
 * No migrations. No production tenants. Existing API fields only.
 *
 * Usage:
 *   WEB not required. API + Supabase auth required.
 *   node apps/web/scripts/quote_fast_quote_q3b_seed_fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, ".env")),
  ...loadEnv(path.join(ROOT, "apps/web/.env")),
  ...process.env,
};

const OUT = path.join(ROOT, "Docs/quote-fast-quote-q3b-qa");
fs.mkdirSync(OUT, { recursive: true });

const API = (env.VITE_API_URL || env.API_PUBLIC_URL || "http://localhost:8000").replace(/\/$/, "");
const SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const EMAIL = env.QA_EMAIL || "phase1b.owner.1790012816@sitesecure.test";
const PASSWORD = env.QA_PASSWORD || "Phase1b-1790012816-Qa!";
const WORKSPACE = env.QA_WORKSPACE_ID || "50339413-11c7-4903-820c-7541fbd2a476";
const KNOWN_QUOTE = env.QA_QUOTE_ID || "c79b9091-6200-454e-b0f9-c7dee78007f6";

const PRODUCTS = [
  {
    sku: "QA-CAM-4MP",
    name: "QA Camera 4MP",
    manufacturer: "QA Mfr",
    model: "QA-CAM-4MP-M",
    kind: "product",
    list_price: 450,
    cost: 220,
    description: "Synthetic QA dome camera 4MP",
  },
  {
    sku: "QA-NVR-8CH",
    name: "QA NVR 8CH",
    manufacturer: "QA Mfr",
    model: "QA-NVR-8",
    kind: "product",
    list_price: 1200,
    cost: 700,
    description: "Synthetic QA network video recorder 8ch",
  },
  {
    sku: "QA-HDD-4TB",
    name: "QA HDD 4TB",
    manufacturer: "QA Mfr",
    model: "QA-HDD-4T",
    kind: "product",
    list_price: 380,
    cost: 210,
    description: "Synthetic QA surveillance HDD 4TB",
  },
  {
    sku: "QA-POE-8",
    name: "QA PoE Switch 8",
    manufacturer: "QA Mfr",
    model: "QA-POE-8P",
    kind: "product",
    list_price: 520,
    cost: 290,
    description: "Synthetic QA PoE network switch",
  },
  {
    sku: "QA-LABOR-INSTALL",
    name: "QA Installation Labor",
    manufacturer: null,
    model: null,
    kind: "service",
    list_price: 350,
    cost: 0,
    description: "Synthetic QA installation labor unit",
    unit: "hour",
  },
];

const PACKAGE_NAME = "QA CCTV 4 Camera Package";
const TEMPLATE_NAME = "QA CCTV Quote Template";

if (!SUPABASE_URL || !ANON) {
  console.error("missing SUPABASE_URL / ANON");
  process.exit(1);
}

const tokenJson = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());

if (!tokenJson.access_token) {
  console.error("auth failed", tokenJson);
  process.exit(1);
}

const auth = {
  Authorization: `Bearer ${tokenJson.access_token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

async function api(method, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: auth,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${pathName} → ${res.status} ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function ensureProduct(spec) {
  const found = await api(
    "GET",
    `/api/v1/workspaces/${WORKSPACE}/catalog/products?q=${encodeURIComponent(spec.sku)}&limit=20`,
  );
  const existing = (found.items || []).find((p) => (p.sku || "") === spec.sku);
  if (existing) {
    return { ...existing, _reused: true };
  }
  const created = await api("POST", `/api/v1/workspaces/${WORKSPACE}/catalog/products`, {
    name: spec.name,
    sku: spec.sku,
    kind: spec.kind,
    list_price: spec.list_price,
    cost: spec.cost,
    description: spec.description,
    unit: spec.unit || "unit",
    manufacturer: spec.manufacturer,
    model: spec.model,
    is_active: true,
    vat_eligible: true,
  });
  return { ...created, _reused: false };
}

async function ensurePackage(productMap) {
  const listed = await api("GET", `/api/v1/workspaces/${WORKSPACE}/catalog/packages`);
  const existing = (listed.items || []).find((p) => p.name === PACKAGE_NAME);
  if (existing) {
    return { ...existing, _reused: true };
  }
  const items = [
    { product_id: productMap["QA-CAM-4MP"].id, description: "QA Camera 4MP", qty: 4, sort_order: 10 },
    { product_id: productMap["QA-NVR-8CH"].id, description: "QA NVR 8CH", qty: 1, sort_order: 20 },
    { product_id: productMap["QA-HDD-4TB"].id, description: "QA HDD 4TB", qty: 1, sort_order: 30 },
    { product_id: productMap["QA-POE-8"].id, description: "QA PoE Switch 8", qty: 1, sort_order: 40 },
    {
      product_id: productMap["QA-LABOR-INSTALL"].id,
      description: "QA Installation Labor",
      qty: 1,
      sort_order: 50,
    },
  ];
  const created = await api("POST", `/api/v1/workspaces/${WORKSPACE}/catalog/packages`, {
    name: PACKAGE_NAME,
    description: "Synthetic QA CCTV package for Fast Quote benchmark — not for production use",
    category: "cctv",
    items,
  });
  return { ...created, _reused: false };
}

async function ensureTemplate(productMap, customerId, siteId) {
  const listed = await api("GET", `/api/v1/workspaces/${WORKSPACE}/catalog/templates`);
  const existing = (listed.items || []).find((t) => t.name_he === TEMPLATE_NAME);
  if (existing) {
    return { ...existing, _reused: true };
  }
  // Build a disposable draft quote, add lines, save-as-template.
  const quote = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes`, {
    customer_id: customerId || undefined,
    site_id: siteId || undefined,
    title: "QA fixture seed quote (disposable)",
  });
  const quoteId = quote.id;
  const lines = [
    { product_id: productMap["QA-CAM-4MP"].id, qty: 4 },
    { product_id: productMap["QA-NVR-8CH"].id, qty: 1 },
    { product_id: productMap["QA-HDD-4TB"].id, qty: 1 },
    { product_id: productMap["QA-LABOR-INSTALL"].id, qty: 1, item_type: "labor" },
  ];
  for (const line of lines) {
    await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/items`, {
      product_id: line.product_id,
      qty: line.qty,
      item_type: line.item_type || "catalog",
    });
  }
  const template = await api("POST", `/api/v1/workspaces/${WORKSPACE}/quotes/${quoteId}/save-as-template`, {
    name_he: TEMPLATE_NAME,
    description: "Synthetic QA CCTV quote structure for Fast Quote benchmark",
    category: "cctv",
    include_terms: false,
  });
  return { ...template, _reused: false, _seedQuoteId: quoteId };
}

async function resolveCustomerSite() {
  // Prefer known draft quote context
  try {
    const quote = await api("GET", `/api/v1/workspaces/${WORKSPACE}/quotes/${KNOWN_QUOTE}`);
    if (quote.customer_id && quote.site_id) {
      return {
        customer_id: quote.customer_id,
        site_id: quote.site_id,
        customer_name: quote.customer_name || null,
        site_name: quote.site_name || null,
        source: "known_quote",
      };
    }
  } catch {
    /* fall through */
  }
  const customers = await api("GET", `/api/v1/workspaces/${WORKSPACE}/customers?limit=20`);
  const customer = (customers.items || [])[0];
  if (!customer) {
    throw new Error("no customers in QA workspace — cannot bind fixture context");
  }
  const sites = await api(
    "GET",
    `/api/v1/workspaces/${WORKSPACE}/sites?customer_id=${customer.id}&limit=20`,
  );
  let site = (sites.items || [])[0];
  if (!site) {
    site = await api("POST", `/api/v1/workspaces/${WORKSPACE}/sites`, {
      customer_id: customer.id,
      name: "QA Benchmark Site",
      address: "1 QA Street",
    });
  }
  return {
    customer_id: customer.id,
    site_id: site.id,
    customer_name: customer.display_name || customer.name || null,
    site_name: site.name || null,
    source: "listed",
  };
}

const report = {
  measuredAt: new Date().toISOString(),
  workspaceId: WORKSPACE,
  email: EMAIL,
  api: API,
  products: [],
  package: null,
  template: null,
  context: null,
};

try {
  const context = await resolveCustomerSite();
  report.context = context;

  const productMap = {};
  for (const spec of PRODUCTS) {
    const row = await ensureProduct(spec);
    productMap[spec.sku] = row;
    report.products.push({
      sku: spec.sku,
      id: row.id,
      name: row.name,
      kind: row.kind,
      list_price: row.list_price ?? row.selling_price,
      reused: Boolean(row._reused),
    });
  }

  const pkg = await ensurePackage(productMap);
  report.package = {
    id: pkg.id,
    name: pkg.name || PACKAGE_NAME,
    reused: Boolean(pkg._reused),
  };

  const template = await ensureTemplate(productMap, context.customer_id, context.site_id);
  report.template = {
    id: template.id,
    name_he: template.name_he || TEMPLATE_NAME,
    reused: Boolean(template._reused),
    seedQuoteId: template._seedQuoteId || null,
  };

  const fixture = {
    workspaceId: WORKSPACE,
    email: EMAIL,
    customerId: context.customer_id,
    siteId: context.site_id,
    customerName: context.customer_name,
    siteName: context.site_name,
    products: report.products,
    packageId: report.package.id,
    packageName: report.package.name,
    templateId: report.template.id,
    templateName: report.template.name_he,
    searchTerms: {
      camera: "QA Camera",
      nvr: "QA NVR",
      hdd: "QA HDD",
      labor: "QA Installation",
    },
  };
  fs.writeFileSync(path.join(OUT, "fixture.json"), JSON.stringify(fixture, null, 2));
  fs.writeFileSync(path.join(OUT, "seed-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, fixture, report }, null, 2));
} catch (err) {
  report.error = String(err);
  fs.writeFileSync(path.join(OUT, "seed-report.json"), JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exit(1);
}

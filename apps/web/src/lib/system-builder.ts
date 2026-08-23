import type { CatalogProduct } from "@site-secure/api-client";

export type SystemBuilderType = "cctv" | "alarm" | "access_control" | "intercom" | "network" | "low_voltage" | "combined";

export type CctvBuilderInput = {
  cameraCount: number;
  cameraType: "dome" | "bullet" | "mixed";
  needsRecorder: boolean;
  needsStorage: boolean;
  needsPoe: boolean;
  needsCabling: boolean;
  needsInstallation: boolean;
  needsRemote: boolean;
};

export type SystemBuilderLine = {
  role: string;
  label: string;
  qty: number;
  product: CatalogProduct | null;
  configured: boolean;
  reason: string;
};

function scoreProduct(product: CatalogProduct, needles: string[]): number {
  const hay = `${product.name} ${product.sku} ${product.description ?? ""}`.toLowerCase();
  let score = 0;
  for (const needle of needles) {
    if (hay.includes(needle.toLowerCase())) score += 1;
  }
  return score;
}

function pickProduct(catalog: CatalogProduct[], needles: string[]): CatalogProduct | null {
  let best: CatalogProduct | null = null;
  let bestScore = 0;
  for (const product of catalog) {
    const score = scoreProduct(product, needles);
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function nvrChannelsForCameras(count: number): number {
  if (count <= 4) return 4;
  if (count <= 8) return 8;
  if (count <= 16) return 16;
  if (count <= 32) return 32;
  return 64;
}

/**
 * Build a CCTV recommendation from user input + available catalog.
 * Never invents products or prices — missing matches are "Not configured".
 */
export function buildCctvRecommendation(
  input: CctvBuilderInput,
  catalog: CatalogProduct[],
): SystemBuilderLine[] {
  const lines: SystemBuilderLine[] = [];
  const cameraNeedles =
    input.cameraType === "dome"
      ? ["camera", "מצלמ", "dome", "כיפה"]
      : input.cameraType === "bullet"
        ? ["camera", "מצלמ", "bullet", "קנה"]
        : ["camera", "מצלמ", "ipc", "cctv"];

  const camera = pickProduct(catalog, cameraNeedles);
  lines.push({
    role: "camera",
    label: "מצלמה",
    qty: Math.max(1, input.cameraCount),
    product: camera,
    configured: Boolean(camera),
    reason: `${input.cameraCount} מצלמות לפי בחירת המשתמש`,
  });

  if (input.needsRecorder) {
    const channels = nvrChannelsForCameras(input.cameraCount);
    const nvr = pickProduct(catalog, ["nvr", "מקליט", "dvr", `${channels}`]);
    lines.push({
      role: "nvr",
      label: `מקליט ${channels} ערוצים`,
      qty: 1,
      product: nvr,
      configured: Boolean(nvr),
      reason: `המלצה ל־${channels}CH לפי ${input.cameraCount} מצלמות — המשתמש יכול לשנות`,
    });
  }

  if (input.needsStorage) {
    const hdd = pickProduct(catalog, ["hdd", "כונן", "אחסון", "storage", "tb"]);
    lines.push({
      role: "storage",
      label: "אחסון / HDD",
      qty: 1,
      product: hdd,
      configured: Boolean(hdd),
      reason: "הקלטה דורשת אחסון",
    });
  }

  if (input.needsPoe) {
    const poe = pickProduct(catalog, ["poe", "switch", "מתג", "פוי"]);
    lines.push({
      role: "poe",
      label: "מתג PoE",
      qty: 1,
      product: poe,
      configured: Boolean(poe),
      reason: "רשת/הזנה למצלמות",
    });
  }

  if (input.needsCabling) {
    const cable = pickProduct(catalog, ["cable", "כבל", "cat6", "utp", "תשתית"]);
    lines.push({
      role: "cabling",
      label: "תשתית / כבילה",
      qty: Math.max(1, input.cameraCount),
      product: cable,
      configured: Boolean(cable),
      reason: "תשתית חדשה לפי מצלמה",
    });
  }

  if (input.needsInstallation) {
    const labor = pickProduct(catalog, ["install", "התקנ", "עבודה", "labor", "service"]);
    lines.push({
      role: "installation",
      label: "התקנה והגדרה",
      qty: 1,
      product: labor,
      configured: Boolean(labor),
      reason: "עבודת התקנה",
    });
  }

  if (input.needsRemote) {
    const remote = pickProduct(catalog, ["remote", "app", "צפייה", "cloud", "ענן"]);
    lines.push({
      role: "remote",
      label: "צפייה מרחוק / אפליקציה",
      qty: 1,
      product: remote,
      configured: Boolean(remote),
      reason: "דרישת צפייה מרחוק מהליד/משתמש",
    });
  }

  return lines;
}

export function defaultCctvInputFromLead(opts: {
  cameraCount?: number | null;
  recording?: boolean | null;
  remoteViewing?: boolean | null;
  infrastructure?: string | null;
}): CctvBuilderInput {
  const infra = (opts.infrastructure ?? "").toLowerCase();
  const needsCabling = /חדש|new|partial|חלק/.test(infra) || !opts.infrastructure;
  return {
    cameraCount: opts.cameraCount && opts.cameraCount > 0 ? opts.cameraCount : 4,
    cameraType: "mixed",
    needsRecorder: true,
    needsStorage: opts.recording !== false,
    needsPoe: true,
    needsCabling,
    needsInstallation: true,
    needsRemote: Boolean(opts.remoteViewing),
  };
}

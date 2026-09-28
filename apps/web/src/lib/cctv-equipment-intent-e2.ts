/**
 * E2 — Durable Equipment Intent helpers (design-side, no Product / price).
 */

import type { EquipmentIntent } from "@site-secure/api-client";

export type SelectionKind = "catalog" | "intent" | "unresolved";

const FORBIDDEN_ATTR_KEYS = new Set([
  "cost",
  "list_price",
  "unit_price",
  "subtotal_net",
  "vat_amount",
  "total_gross",
  "margin",
  "margin_percent",
  "product_id",
  "sku",
  "catalog_price",
]);

/** True when intent carries any user-facing equipment definition. */
export function hasEquipmentIntent(intent: EquipmentIntent | null | undefined): boolean {
  if (!intent) return false;
  if (intent.manufacturer?.trim()) return true;
  if (intent.model_reference?.trim()) return true;
  if (intent.display_description?.trim()) return true;
  const attrs = intent.selected_attributes;
  if (attrs && Object.keys(attrs).length > 0) return true;
  return false;
}

/** Normalize for persistence — strips empties and forbidden commercial keys. */
export function normalizeEquipmentIntent(
  raw: EquipmentIntent | null | undefined,
): EquipmentIntent | null {
  if (!raw) return null;
  const out: EquipmentIntent = {};
  const mfr = raw.manufacturer?.trim();
  const model = raw.model_reference?.trim();
  const desc = raw.display_description?.trim();
  if (mfr) out.manufacturer = mfr.slice(0, 240);
  if (model) out.model_reference = model.slice(0, 240);
  if (desc) out.display_description = desc.slice(0, 240);
  if (raw.selected_attributes && typeof raw.selected_attributes === "object") {
    const attrs: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(raw.selected_attributes)) {
      if (FORBIDDEN_ATTR_KEYS.has(k)) continue;
      if (typeof v === "string") {
        const t = v.trim();
        if (t) attrs[k.slice(0, 80)] = t.slice(0, 240);
      } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
        attrs[k.slice(0, 80)] = v;
      }
    }
    if (Object.keys(attrs).length) out.selected_attributes = attrs;
  }
  return hasEquipmentIntent(out) ? out : null;
}

export function formatEquipmentIntentSummary(intent: EquipmentIntent | null | undefined): string {
  if (!hasEquipmentIntent(intent)) return "";
  const parts = [intent!.manufacturer?.trim(), intent!.model_reference?.trim()].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return intent!.display_description?.trim() || "";
}

/**
 * Fingerprint of engineering technical requirements used to detect
 * requirement change for needs_review (not proven incompatibility).
 */
export function technicalRequirementsFingerprint(tech: Record<string, unknown> | null | undefined): string {
  if (!tech || typeof tech !== "object") return "";
  const keys = [
    "resolutionMp",
    "resolution_mp",
    "minResolutionMp",
    "environment",
    "installEnvironment",
    "formFactor",
    "form_factor",
    "poeRequired",
    "poe",
    "power",
    "minChannels",
    "min_channels",
    "channels",
    "requiredTb",
    "required_tb",
    "requiredTbWithOverhead",
    "minPoePorts",
    "min_poe_ports",
    "minPorts",
    "minPoeBudgetW",
    "minBudgetW",
    "meters",
    "distanceMeters",
    "cableDistanceMeters",
  ];
  const picked: Record<string, unknown> = {};
  for (const k of keys) {
    if (tech[k] !== undefined && tech[k] !== null && tech[k] !== "") {
      picked[k] = tech[k];
    }
  }
  return JSON.stringify(picked);
}

export function manufacturerSuggestionsFromCandidates(
  manufacturers: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of manufacturers) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    const key = t.toLocaleLowerCase("he");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.localeCompare(b, "he"));
}

export type IntentByRole = Record<string, EquipmentIntent | null>;

/** Derive equipment resolution mode — mutually exclusive catalog vs intent. */
export function deriveSelectionKind(
  productId: string | null | undefined,
  intent: EquipmentIntent | null | undefined,
): SelectionKind {
  if (productId) return "catalog";
  if (hasEquipmentIntent(intent)) return "intent";
  return "unresolved";
}

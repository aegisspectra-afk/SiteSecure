import type { QuoteItemOut } from "@site-secure/api-client";

/** Local string drafts — empty string is valid while the user is typing. */
export type QuoteLineDraft = {
  description: string;
  sku: string;
  qty: string;
  unit_price: string;
  discount: string;
};

export type QuoteLineField = keyof QuoteLineDraft;

export const QUOTE_LINE_FIELDS: QuoteLineField[] = [
  "description",
  "sku",
  "qty",
  "unit_price",
  "discount",
];

export type QuoteLinePatch = {
  description?: string;
  sku?: string | null;
  qty?: number;
  unit_price?: number;
  discount?: number;
  discount_type?: "percent" | "amount";
};

export const LINE_ITEM_DISCOUNT_TYPE = "percent" as const;

export function lineDraftFromItem(item: QuoteItemOut): QuoteLineDraft {
  const discount = item.discount ?? 0;
  return {
    description: item.description ?? "",
    sku: item.sku ?? "",
    qty: formatDraftNumber(item.qty),
    unit_price: formatDraftNumber(item.unit_price),
    discount: discount === 0 ? "" : formatDraftNumber(discount),
  };
}

function formatDraftNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

/** Parse draft number for display/preview; empty keeps the previous committed value. */
export function parseDraftNumber(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Coerce draft to API numbers on persist; empty numeric fields become 0. */
export function coerceDraftNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Mirror backend pricing.line_net with percent line discounts. */
export function applyLineDiscount(gross: number, discount: number, discountType: string): number {
  if (gross <= 0) return 0;
  const dtype = (discountType || "amount").toLowerCase();
  let amount = discount;
  if (dtype === "percent" || dtype === "%") {
    const pct = Math.min(100, Math.max(0, discount));
    amount = Math.round((gross * pct) / 100 * 100) / 100;
  }
  const net = Math.round((gross - amount) * 100) / 100;
  return net < 0 ? 0 : net;
}

export function previewLineNet(item: QuoteItemOut, draft: QuoteLineDraft): number {
  if (item.item_type === "note") return 0;
  const qty = parseDraftNumber(draft.qty, item.qty);
  const price = parseDraftNumber(draft.unit_price, item.unit_price);
  const gross = Math.round(qty * price * 100) / 100;
  const discount = parseDraftNumber(draft.discount, item.discount ?? 0);
  return applyLineDiscount(gross, discount, LINE_ITEM_DISCOUNT_TYPE);
}

export function lineDraftToPatch(draft: QuoteLineDraft, item: QuoteItemOut): QuoteLinePatch | null {
  const patch: QuoteLinePatch = {};
  if (draft.description !== (item.description ?? "")) {
    patch.description = draft.description;
  }
  const sku = draft.sku.trim() || null;
  if (sku !== (item.sku ?? null)) {
    patch.sku = sku;
  }
  const qty = coerceDraftNumber(draft.qty);
  if (Math.abs(qty - item.qty) > 0.0001) {
    patch.qty = qty;
  }
  const unitPrice = coerceDraftNumber(draft.unit_price);
  if (Math.abs(unitPrice - item.unit_price) > 0.0001) {
    patch.unit_price = unitPrice;
  }
  const discount = coerceDraftNumber(draft.discount);
  const itemDiscount = item.discount ?? 0;
  const itemDiscountType = (item.discount_type || "amount").toLowerCase();
  if (Math.abs(discount - itemDiscount) > 0.0001 || itemDiscountType !== LINE_ITEM_DISCOUNT_TYPE) {
    patch.discount = discount;
    patch.discount_type = LINE_ITEM_DISCOUNT_TYPE;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Build a patch only for the requested editable fields (used for per-field autosave). */
export function lineDraftToPatchForFields(
  draft: QuoteLineDraft,
  item: QuoteItemOut,
  fields: ReadonlySet<QuoteLineField>,
): QuoteLinePatch | null {
  const full = lineDraftToPatch(draft, item);
  if (!full) return null;
  const patch: QuoteLinePatch = {};
  if (fields.has("description") && full.description !== undefined) patch.description = full.description;
  if (fields.has("sku") && full.sku !== undefined) patch.sku = full.sku;
  if (fields.has("qty") && full.qty !== undefined) patch.qty = full.qty;
  if (fields.has("unit_price") && full.unit_price !== undefined) patch.unit_price = full.unit_price;
  if (fields.has("discount") && full.discount !== undefined) {
    patch.discount = full.discount;
    patch.discount_type = full.discount_type;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Fields whose local draft differs from the last server snapshot. */
export function dirtyLineFields(draft: QuoteLineDraft, item: QuoteItemOut): Set<QuoteLineField> {
  const dirty = new Set<QuoteLineField>();
  for (const field of QUOTE_LINE_FIELDS) {
    const single = lineDraftToPatchForFields(draft, item, new Set([field]));
    if (single) dirty.add(field);
  }
  return dirty;
}

export function patchFieldsFromPatch(patch: QuoteLinePatch): QuoteLineField[] {
  const fields: QuoteLineField[] = [];
  if (patch.description !== undefined) fields.push("description");
  if (patch.sku !== undefined) fields.push("sku");
  if (patch.qty !== undefined) fields.push("qty");
  if (patch.unit_price !== undefined) fields.push("unit_price");
  if (patch.discount !== undefined || patch.discount_type !== undefined) fields.push("discount");
  return fields;
}

/**
 * Merge server item into local draft while preserving fields the user is editing
 * (focused and/or dirty with unsaved local changes).
 */
export function mergeDraftFromItem(
  prev: QuoteLineDraft,
  item: QuoteItemOut,
  protectedFields: ReadonlySet<QuoteLineField>,
): QuoteLineDraft {
  const next = lineDraftFromItem(item);
  const merged = { ...next };
  for (const field of protectedFields) {
    merged[field] = prev[field];
  }
  return merged;
}

import type { LeadOut, QuoteGap, QuoteItemOut } from "@site-secure/api-client";
import { leadRequirementsSummary } from "./leads";

export type QuoteGapSeverity = "critical" | "warning" | "info";

export type LeadRequirementRow = {
  id: string;
  label: string;
  value: string;
};

export function gapSeverity(gap: QuoteGap): QuoteGapSeverity {
  const raw = (gap as QuoteGap & { severity?: string }).severity;
  if (raw === "warning" || raw === "info" || raw === "critical") return raw;
  return "critical";
}

export function partitionGaps(gaps: QuoteGap[]) {
  const critical: QuoteGap[] = [];
  const warning: QuoteGap[] = [];
  const info: QuoteGap[] = [];
  for (const gap of gaps) {
    const severity = gapSeverity(gap);
    if (severity === "warning") warning.push(gap);
    else if (severity === "info") info.push(gap);
    else critical.push(gap);
  }
  return { critical, warning, info };
}

export function canSendWithGaps(gaps: QuoteGap[]): boolean {
  return partitionGaps(gaps).critical.length === 0;
}

export type QuoteGapDomain = "completeness" | "technical" | "financial";

const COMPLETENESS_CODES = new Set([
  "company",
  "customer",
  "title",
  "valid_until",
  "payment_terms",
  "items",
  "prices",
]);

const FINANCIAL_CODES = new Set([
  "margin_below_target",
  "margin_below_minimum",
  "margin_overridden",
]);

export function gapDomain(gap: QuoteGap): QuoteGapDomain {
  const code = gap.code || "";
  if (FINANCIAL_CODES.has(code) || gap.field === "margin") return "financial";
  if (COMPLETENESS_CODES.has(code)) return "completeness";
  return "technical";
}

/** Hide misleading 0% margin critical/warning when there are no priced lines. */
export function filterEmptyQuoteMarginGaps(gaps: QuoteGap[], pricedCount: number): QuoteGap[] {
  if (pricedCount > 0) return gaps;
  return gaps.filter((gap) => gapDomain(gap) !== "financial");
}

export function groupGapsByDomain(gaps: QuoteGap[]) {
  const completeness: QuoteGap[] = [];
  const technical: QuoteGap[] = [];
  const financial: QuoteGap[] = [];
  for (const gap of gaps) {
    const domain = gapDomain(gap);
    if (domain === "completeness") completeness.push(gap);
    else if (domain === "financial") financial.push(gap);
    else technical.push(gap);
  }
  return { completeness, technical, financial };
}

export function completenessScore(gaps: QuoteGap[]): { done: number; total: number } {
  const checks = ["customer", "title", "valid_until", "payment_terms", "items"] as const;
  const missing = new Set(
    gaps.filter((g) => gapDomain(g) === "completeness").map((g) => g.code),
  );
  const done = checks.filter((code) => !missing.has(code)).length;
  return { done, total: checks.length };
}

/** Detect sale-price override vs catalog list/selling price in snapshot. */
export function isPriceOverride(item: QuoteItemOut): boolean {
  const snap = item.catalog_snapshot ?? {};
  const list =
    typeof snap.list_price === "number"
      ? snap.list_price
      : typeof snap.selling_price === "number"
        ? snap.selling_price
        : null;
  if (list == null || item.item_type === "note") return false;
  return Math.abs(Number(item.unit_price) - Number(list)) > 0.009;
}

export function catalogListPrice(item: QuoteItemOut): number | null {
  const snap = item.catalog_snapshot ?? {};
  if (typeof snap.list_price === "number") return snap.list_price;
  if (typeof snap.selling_price === "number") return snap.selling_price;
  return null;
}

export function leadRequirementRows(lead: LeadOut | null | undefined): LeadRequirementRow[] {
  if (!lead) return [];
  const req = lead.requirements ?? {};
  const rows: LeadRequirementRow[] = [];
  if (req.camera_count) {
    rows.push({ id: "cameras", label: "מצלמות", value: String(req.camera_count) });
  }
  if (req.location) {
    rows.push({ id: "location", label: "מיקום", value: String(req.location) });
  }
  if (req.infrastructure) {
    rows.push({ id: "infra", label: "תשתית", value: String(req.infrastructure) });
  }
  if (req.recording != null) {
    rows.push({ id: "recording", label: "הקלטה", value: req.recording ? "כן" : "לא" });
  }
  if (req.remote_viewing != null) {
    rows.push({ id: "remote", label: "צפייה מרחוק", value: req.remote_viewing ? "כן" : "לא" });
  }
  if (!rows.length && lead.notes?.trim()) {
    rows.push({ id: "notes", label: "הערות", value: lead.notes.trim() });
  }
  return rows;
}

export function leadRequirementsChip(lead: LeadOut | null | undefined): string {
  if (!lead) return "";
  return leadRequirementsSummary(lead);
}

/**
 * Soft client advisories from lead + line text heuristics.
 * Never blocks send; complements server gaps.
 */
export function softQuoteAdvisories(opts: {
  lead?: LeadOut | null;
  items: QuoteItemOut[];
}): QuoteGap[] {
  const gaps: QuoteGap[] = [];
  const blob = opts.items.map((item) => `${item.description} ${item.name ?? ""} ${item.sku ?? ""}`.toLowerCase()).join(" ");
  const lead = opts.lead;
  const cameras = lead?.requirements?.camera_count ?? null;

  if (cameras && cameras > 0) {
    const hasNvr = /nvr|מקליט|dvr/.test(blob);
    if (!hasNvr) {
      gaps.push({
        field: "items",
        code: "advisory_nvr",
        message: `הליד מבקש ${cameras} מצלמות — לא זוהה מקליט (NVR) בהצעה.`,
        severity: "warning",
      } as QuoteGap);
    }
  }

  if (lead?.requirements?.recording) {
    const hasStorage = /hdd|כונן|אחסון|storage|tb|gb/.test(blob);
    if (!hasStorage) {
      gaps.push({
        field: "items",
        code: "advisory_hdd",
        message: "הליד ביקש הקלטה — לא זוהה אחסון/HDD בהצעה.",
        severity: "warning",
      } as QuoteGap);
    }
  }

  if (lead?.requirements?.remote_viewing) {
    gaps.push({
      field: "items",
      code: "advisory_remote",
      message: "הליד ביקש צפייה מרחוק — ודאו שההצעה כוללת הגדרה/אפליקציה.",
      severity: "info",
    } as QuoteGap);
  }

  return gaps;
}

export function mergeQuoteGaps(serverGaps: QuoteGap[], softGaps: QuoteGap[]): QuoteGap[] {
  const seen = new Set(serverGaps.map((g) => `${g.code}:${g.field}`));
  const merged = [...serverGaps];
  for (const gap of softGaps) {
    const key = `${gap.code}:${gap.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(gap);
  }
  return merged;
}

export function sortedQuoteItems(items: QuoteItemOut[]): QuoteItemOut[] {
  return [...items].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function neighborSortOrders(
  items: QuoteItemOut[],
  itemId: string,
  direction: "up" | "down",
): { itemId: string; sort_order: number; swapId: string; swap_order: number } | null {
  const rows = sortedQuoteItems(items);
  const index = rows.findIndex((row) => row.id === itemId);
  if (index < 0) return null;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return null;
  const current = rows[index]!;
  const swap = rows[swapIndex]!;
  return {
    itemId: current.id,
    sort_order: swap.sort_order ?? swapIndex * 10,
    swapId: swap.id,
    swap_order: current.sort_order ?? index * 10,
  };
}

/**
 * Gap between existing Docs and the PO-approved C0–C2 approach.
 * Planning note only — not a product surface.
 */
export const DOMAIN_DOCS_GAP = {
  sources: [
    "Docs/QUOTE-BUILDER-UNIFIED-PRODUCT-ARCHITECTURE.md §§14–16",
    "Docs/SYSTEM-DESIGN-ENGINE-PLATFORM-DISCOVERY.md",
  ],
  docsSaid: [
    "System Builder is an engineering engine; Manual/Catalog/Template are separate input methods, not domains in the picker.",
    "Hide non-CCTV engine options until a real calculate+recommend+apply module exists.",
    "Defer a future-engine registry; do not implement one in the discovery phase.",
    "One quote spine; multiple input methods converge at quote_items + pricing.recalculate.",
    "Do not invent Alarm/Access formulas; CCTV math stays CCTV-owned.",
  ],
  thisApproach: [
    "«בנייה חופשית» is a permanent picker domain with no wizard — Docs called this Manual/Catalog, not a System Builder type.",
    "The registry is implemented now (C0) instead of deferred.",
    "A quote may carry several domains at once (CCTV design + free lines + future engines).",
    "Shared definition (questions/roles/mapping/i18n) is separated from a verified engineering module.",
    "Hidden domains still match Docs: no verified module → not in the picker.",
  ],
  preservedFromDocs: [
    "CCTV is the only production engine (cctv_sizing, cctv_recommend, role_key, Equipment Intent, Apply, pricing.recalculate).",
    "No invented Alarm/Access math.",
    "One commercial quote and one pricing authority.",
  ],
} as const;

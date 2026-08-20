import type { QuoteOut, QuotePatchBody } from "@site-secure/api-client";

export type QuoteHeaderDraft = {
  customer_id: string;
  site_id: string;
  title: string;
  valid_until: string;
  project_name: string;
  project_address: string;
  summary: string;
  key_points: string;
  discount_type: string;
  discount_value: string;
  payment_terms: string;
  warranty: string;
  general_terms: string;
  customer_notes: string;
  internal_notes: string;
  template_id: string;
};

export const QUOTE_FIELD_IDS: Record<string, string> = {
  customer: "customer_id",
  customer_id: "customer_id",
  title: "title",
  valid_until: "valid_until",
  payment_terms: "payment_terms",
  items: "quote-items",
  prices: "quote-items",
  company: "quote-company",
};

export function headerFromQuote(quote: QuoteOut): QuoteHeaderDraft {
  return {
    customer_id: quote.customer_id ?? "",
    site_id: quote.site_id ?? "",
    title: quote.title ?? "",
    valid_until: (quote.valid_until ?? "").slice(0, 10),
    project_name: quote.project_name ?? "",
    project_address: quote.project_address ?? "",
    summary: quote.summary ?? "",
    key_points: quote.key_points ?? "",
    discount_type: quote.discount_type ?? "",
    discount_value: quote.discount_value != null ? String(quote.discount_value) : "",
    payment_terms: quote.payment_terms ?? "",
    warranty: quote.warranty ?? "",
    general_terms: quote.general_terms ?? "",
    customer_notes: quote.customer_notes ?? "",
    internal_notes: quote.internal_notes ?? "",
    template_id: quote.template_id ?? "",
  };
}

export function headerPatch(draft: QuoteHeaderDraft): QuotePatchBody {
  const discountValue = draft.discount_value.trim() === "" ? 0 : Number(draft.discount_value);
  return {
    customer_id: draft.customer_id || undefined,
    site_id: draft.site_id || undefined,
    title: draft.title.trim() || undefined,
    valid_until: draft.valid_until || undefined,
    project_name: draft.project_name.trim() || undefined,
    project_address: draft.project_address.trim() || undefined,
    summary: draft.summary.trim() || undefined,
    key_points: draft.key_points.trim() || undefined,
    discount_type: draft.discount_type || undefined,
    discount_value: Number.isFinite(discountValue) ? discountValue : 0,
    payment_terms: draft.payment_terms.trim() || undefined,
    warranty: draft.warranty.trim() || undefined,
    general_terms: draft.general_terms.trim() || undefined,
    customer_notes: draft.customer_notes.trim() || undefined,
    internal_notes: draft.internal_notes.trim() || undefined,
    template_id: draft.template_id || undefined,
  };
}

export function headersEqual(a: QuoteHeaderDraft, b: QuoteHeaderDraft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function draftHasContent(draft: QuoteHeaderDraft): boolean {
  return Boolean(
    draft.customer_id ||
      draft.site_id ||
      draft.title.trim() ||
      draft.project_name.trim() ||
      draft.project_address.trim() ||
      draft.summary.trim() ||
      draft.key_points.trim() ||
      draft.payment_terms.trim() ||
      draft.warranty.trim() ||
      draft.general_terms.trim() ||
      draft.customer_notes.trim() ||
      draft.internal_notes.trim() ||
      draft.template_id ||
      (draft.discount_value.trim() !== "" && draft.discount_value !== "0"),
  );
}

export function unsavedQuote(workspaceId: string): QuoteOut {
  return {
    id: "",
    workspace_id: workspaceId,
    number: "",
    status: "draft",
    customer_id: null,
    site_id: null,
    owner_user_id: null,
    currency: "ILS",
    items: [],
    version: 1,
    total_gross: 0,
    validation: { can_send: false, gaps: [] },
  };
}

export function parseNonNegative(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function goToQuoteField(field: string) {
  const id = QUOTE_FIELD_IDS[field] ?? field;
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  if (node instanceof HTMLElement) node.focus();
}

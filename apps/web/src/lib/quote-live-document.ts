import type { PublicQuote, QuoteOut } from "@site-secure/api-client";

/** Build a customer-facing document snapshot from live builder state (no cost/margin). */
export function liveQuoteToPublicDocument(
  quote: QuoteOut,
  opts?: {
    companyName?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    siteName?: string | null;
    siteAddress?: string | null;
  },
): PublicQuote {
  return {
    id: quote.id || "draft",
    number: quote.number || "—",
    version: quote.version ?? 1,
    status: quote.status || "draft",
    superseded: false,
    title: quote.title,
    summary: quote.summary,
    key_points: quote.key_points,
    project_name: quote.project_name,
    project_address: quote.project_address || opts?.siteAddress,
    valid_until: quote.valid_until,
    payment_terms: quote.payment_terms,
    warranty: quote.warranty,
    general_terms: quote.general_terms,
    customer_notes: quote.customer_notes,
    currency: quote.currency || "ILS",
    vat_percent: quote.vat_percent ?? 18,
    discount_type: quote.discount_type,
    discount_value: quote.discount_value,
    subtotal_net: Number(quote.subtotal_net ?? 0),
    vat_amount: Number(quote.vat_amount ?? 0),
    total_gross: Number(quote.total_gross ?? 0),
    company: {
      name: opts?.companyName || "SITE SECURE",
      brand_name: opts?.companyName || "SITE SECURE",
    },
    customer: {
      display_name: opts?.customerName || quote.customer_name,
      phone: opts?.customerPhone,
      email: opts?.customerEmail,
    },
    site: opts?.siteName || quote.site_name
      ? { name: opts?.siteName || quote.site_name, address: opts?.siteAddress ? { line: opts.siteAddress } : undefined }
      : null,
    items: (quote.items ?? []).map((item) => ({
      ...item,
      cost: undefined,
    })),
    sections: quote.sections,
    signature: {
      mode: "approval_name_v1",
      required: true,
      title: "אישור והתחייבות",
      consent_he: "אני מאשר/ת את פרטי הצעת המחיר, התנאים והסכום המופיעים במסמך זה.",
    },
    pdf_ready: true,
    sent_at: quote.sent_at,
    viewed_at: quote.viewed_at,
    approved_at: quote.approved_at,
    rejected_at: quote.rejected_at,
  };
}

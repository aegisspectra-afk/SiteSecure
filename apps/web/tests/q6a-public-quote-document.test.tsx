import { render, screen } from "@testing-library/react";
import type { PublicQuote } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { QuoteDocument } from "../src/components/quotes/document/QuoteDocument";
import { he } from "../src/i18n/he";
import { formatIsraeliPhoneDisplay } from "../src/lib/quote-recipient-phone";

function sampleQuote(over: Partial<PublicQuote> = {}): PublicQuote {
  return {
    id: "q1",
    number: "Q-00002",
    status: "sent",
    version: 1,
    title: "מערכת מצלמות לחצר",
    currency: "ILS",
    subtotal_net: 10000,
    vat_amount: 1700,
    vat_percent: 17,
    total_gross: 11700,
    valid_until: "2099-12-31",
    payment_terms: "שוטף +30",
    warranty: "12 חודשים",
    company: {
      brand_name: "אגיס מערכות",
      name: "אגיס מערכות",
      phone: "0501234567",
      email: null,
      business_number: "514000000",
      business_number_label: "ח.פ.",
    } as PublicQuote["company"],
    customer: { display_name: "גן שקד", phone: "0501000002" },
    site: { name: "אתר גן" },
    items: [
      {
        id: "i1",
        description: "מצלמת רשת 4 מגה־פיקסל",
        sku: "CAM-4MP",
        qty: 4,
        unit_price: 2500,
        line_net: 10000,
        item_type: "free",
      } as PublicQuote["items"][number],
    ],
    can_approve: true,
    can_reject: true,
    superseded: false,
    ...over,
  } as PublicQuote;
}

const LATIN = /[A-Za-z]{3,}/;

describe("Q6A public quote document", () => {
  it("formats Israeli phone for display", () => {
    expect(formatIsraeliPhoneDisplay("0501234567")).toBe("050-123-4567");
  });

  it("uses public presentation: title, summary, מאת/עבור, no SKU, no status English", () => {
    const { container } = render(
      <QuoteDocument quote={sampleQuote()} presentation="public" showStatus={false} hideSignatureBlock />,
    );
    expect(screen.getByTestId("quote-public-summary").textContent).toMatch(/כולל מע״מ/);
    expect(screen.getByTestId("quote-doc-from")).toHaveTextContent(he.quoteDocFrom);
    expect(screen.getByTestId("quote-doc-to")).toHaveTextContent(he.quoteDocTo);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("הצעת מחיר #Q-00002");
    expect(screen.getByRole("heading", { level: 2, name: "מערכת מצלמות לחצר" })).toBeInTheDocument();
    expect(container.querySelector(".quote-doc-col-sku")).toBeNull();
    expect(container.textContent).not.toMatch(/\bCAM-4MP\b/);
    expect(container.textContent).not.toMatch(/\bsent\b/i);
    expect(container.textContent).not.toMatch(/\bdraft\b/i);
    const body = container.querySelector(".quote-doc")?.textContent || "";
    expect(body).not.toMatch(/\bSKU\b/);
    expect(body).not.toMatch(/\bStatus\b/);
    expect(body).not.toMatch(/\bsent\b/i);
    expect(body).not.toMatch(/\bdraft\b/i);
    expect(body).not.toMatch(/\bQuote\b/);
    expect(body).not.toMatch(LATIN);
  });
});

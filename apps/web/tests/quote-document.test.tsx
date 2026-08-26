import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteDocument } from "../src/components/quotes/document/QuoteDocument";
import { he } from "../src/i18n/he";

describe("QuoteDocument", () => {
  it("renders sections, totals, signature block and print root", () => {
    const { container } = render(
      <QuoteDocument
        quote={{
          id: "q1",
          number: "Q-00012",
          version: 1,
          status: "sent",
          superseded: false,
          title: "מערכת מצלמות",
          currency: "ILS",
          vat_percent: 18,
          subtotal_net: 8500,
          vat_amount: 1530,
          total_gross: 10030,
          payment_terms: "40% מקדמה · 60% בגמר",
          company: { name: "אגיס מערכות", brand_name: "אגיס מערכות" },
          customer: { display_name: "איליה קרנר", phone: "0501234567" },
          site: { name: "אתר", address: {} },
          sections: [{ id: "s1", name: "מערכת מצלמות", sort_order: 0 }],
          signature: {
            mode: "approval_name_v1",
            required: true,
            title: he.quoteDocSignatureTitle,
            consent_he: he.quoteDocSignatureConsent,
            fields: ["full_name", "date"],
          },
          items: [
            {
              id: "i1",
              quote_id: "q1",
              description: "מצלמה",
              name: "Cam",
              sku: "CAM-4K-01",
              qty: 2,
              unit_price: 500,
              line_net: 1000,
              item_type: "catalog",
              section_id: "s1",
            },
          ],
        }}
      />,
    );

    expect(container.querySelector("#quote-document-print-root")).toBeTruthy();
    expect(screen.getByText(he.quoteProductSku)).toBeTruthy();
    expect(screen.getByText("CAM-4K-01")).toBeTruthy();
    expect(screen.getByText(he.quoteDocHeroQuote("Q-00012"))).toBeTruthy();
    expect(screen.getAllByText("מערכת מצלמות").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/איליה קרנר/)).toBeTruthy();
    expect(screen.getByText(he.quoteDocPortalSignHint)).toBeTruthy();
    expect(screen.getByText(he.quoteDocSignatureTitle)).toBeTruthy();
    expect(screen.getByText(he.quoteTotalDue)).toBeTruthy();
    expect(screen.getByText(/10,030/)).toBeTruthy();
    expect(screen.getByText(/40%/)).toBeTruthy();
  });
});

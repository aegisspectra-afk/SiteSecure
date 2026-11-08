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

  it("renders note lines without prices in the customer document", () => {
    render(
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
          subtotal_net: 1000,
          vat_amount: 180,
          total_gross: 1180,
          company: { name: "אגיס מערכות", brand_name: "אגיס מערכות" },
          customer: { display_name: "לקוח" },
          site: { name: "אתר", address: {} },
          sections: [],
          items: [
            {
              id: "i1",
              quote_id: "q1",
              description: "מצלמה",
              qty: 1,
              unit_price: 1000,
              line_net: 1000,
              item_type: "catalog",
            },
            {
              id: "n1",
              quote_id: "q1",
              description: "כולל אחריות יצרן",
              qty: 1,
              unit_price: 0,
              line_net: 0,
              item_type: "note",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("כולל אחריות יצרן")).toBeTruthy();
    expect(screen.getByText(/1,180/)).toBeTruthy();
  });

  it("does not expose cost, margin, or internal notes even if leaked on the payload", () => {
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
          subtotal_net: 1000,
          vat_amount: 180,
          total_gross: 1180,
          customer_notes: "הערה ללקוח",
          company: { name: "אגיס מערכות", brand_name: "אגיס מערכות" },
          customer: { display_name: "לקוח" },
          site: { name: "אתר", address: {} },
          sections: [],
          items: [
            {
              id: "i1",
              quote_id: "q1",
              description: "מצלמה",
              qty: 1,
              unit_price: 1000,
              line_net: 1000,
              item_type: "catalog",
              cost: 421,
              internal_notes: "INTERNAL_ONLY_NOTE_XYZ",
            } as never,
          ],
          cost_total: 421,
          margin_amount: 579,
          margin_percent: 57.9,
          internal_notes: "TEAM_INTERNAL_MEMO_XYZ",
        } as never}
      />,
    );

    const text = container.textContent || "";
    expect(text).not.toContain("INTERNAL_ONLY_NOTE_XYZ");
    expect(text).not.toContain("TEAM_INTERNAL_MEMO_XYZ");
    expect(text).not.toContain(he.quoteInternalNotes);
    expect(text).not.toContain(he.quoteCost);
    expect(text).not.toContain(he.quoteMargin);
    expect(text).not.toMatch(/57\.9\s*%/);
    expect(screen.getByText("הערה ללקוח")).toBeTruthy();
    expect(screen.getByText(/1,180/)).toBeTruthy();
  });

  it("marks optional lines and lists discounts before the pre-VAT total, options apart", () => {
    const { container } = render(
      <QuoteDocument
        quote={{
          id: "q2",
          number: "Q-00020",
          version: 1,
          status: "sent",
          superseded: false,
          title: "מצלמות",
          currency: "ILS",
          vat_percent: 18,
          discount_type: "amount",
          discount_value: 50,
          items_subtotal: 1200,
          lines_subtotal: 1100,
          section_discount_amount: 100,
          quote_discount_amount: 50,
          subtotal_net: 1050,
          vat_amount: 189,
          total_gross: 1239,
          optional_subtotal: 300,
          optional_vat_amount: 54,
          optional_total_gross: 354,
          total_with_options_gross: 1593,
          sections_breakdown: [{ section_id: "s1", lines_net: 1000, discount_amount: 100, net: 900 }],
          company: { name: "אגיס", brand_name: "אגיס" },
          customer: { display_name: "לקוח" },
          site: null,
          sections: [{ id: "s1", name: "מצלמות", sort_order: 0 }],
          signature: {
            mode: "approval_name_v1",
            required: true,
            title: he.quoteDocSignatureTitle,
            consent_he: he.quoteDocSignatureConsent,
            fields: ["full_name", "date"],
          },
          items: [
            { id: "a", quote_id: "q2", description: "מצלמה", qty: 2, unit_price: 500, line_net: 1000, item_type: "catalog", section_id: "s1" },
            { id: "b", quote_id: "q2", description: "PTZ", qty: 1, unit_price: 300, line_net: 300, item_type: "catalog", section_id: "s1", is_optional: true },
            { id: "c", quote_id: "q2", description: "התקנה", qty: 1, unit_price: 200, line_net: 200, item_type: "labor" },
          ],
        }}
      />,
    );
    const badges = screen.getAllByTestId("quote-doc-optional-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe(he.quoteDocOptionalNotIncluded);
    const sectionDiscount = container.querySelector(".quote-doc-section-discount")?.textContent ?? "";
    expect(sectionDiscount).toContain("הנחת סעיף");
    expect(sectionDiscount).toContain("100");
    const labels = [...container.querySelectorAll(".quote-doc-totals dt")].map((dt) => dt.textContent);
    expect(labels).toEqual([
      he.quoteDocLinesTotal,
      he.quoteDocSectionDiscounts,
      he.quoteDiscountQuoteLabel,
      he.quoteDocBeforeVat,
      `${he.quoteTax} 18%`,
      he.quoteTotalDue,
      he.quoteDocOptionalTotal,
      he.quoteDocTotalWithOptions,
    ]);
    expect(labels).not.toContain(he.quoteSubtotal);
  });
});

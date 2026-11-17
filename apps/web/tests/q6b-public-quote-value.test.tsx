import type { PublicQuote } from "@site-secure/api-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteDocument } from "../src/components/quotes/document/QuoteDocument";

vi.mock("../src/lib/session", () => ({
  useSession: () => ({ api: {} }),
}));

function sample(over: Partial<PublicQuote> = {}): PublicQuote {
  return {
    id: "q1",
    number: "Q-00020",
    version: 1,
    status: "sent",
    superseded: false,
    currency: "ILS",
    vat_percent: 17,
    subtotal_net: 1000,
    vat_amount: 170,
    total_gross: 1170,
    title: "מערכת מצלמות לבדיקה",
    system_summary: "מערכת מצלמות עם 6 מצלמות בפנים, שמירת הקלטה ל־14 ימים.",
    company: { brand_name: "עסק דמו", phone: "0525550100" },
    customer: { display_name: "לקוח דמו", phone: "0501000001" },
    site: { name: "אתר דמו" },
    items: [
      {
        id: "i1",
        quote_id: "q1",
        description: "מצלמת רשת",
        qty: 2,
        unit_price: 500,
        line_net: 1000,
        thumbnail_url: "https://cdn.example/cam.png",
      },
    ],
    payment_terms: "שוטף +30",
    warranty: "12 חודשים",
    ...over,
  } as PublicQuote;
}

describe("Q6B public quote value", () => {
  it("shows system summary and item thumbnail on public presentation", () => {
    render(<QuoteDocument quote={sample()} presentation="public" showStatus={false} hideSignatureBlock />);
    expect(screen.getByTestId("quote-system-summary").textContent).toMatch(/6 מצלמות/);
    const img = document.querySelector(".quote-doc-line-thumb") as HTMLImageElement | null;
    expect(img?.getAttribute("src")).toBe("https://cdn.example/cam.png");
  });

  it("hides sku on public presentation", () => {
    const q = sample({
      items: [
        {
          id: "i1",
          quote_id: "q1",
          description: "פריט",
          sku: "SKU-HIDE",
          qty: 1,
          unit_price: 10,
          line_net: 10,
        },
      ],
    });
    const { container } = render(
      <QuoteDocument quote={q} presentation="public" showStatus={false} hideSignatureBlock />,
    );
    expect(container.textContent).not.toMatch(/SKU-HIDE/);
  });
});

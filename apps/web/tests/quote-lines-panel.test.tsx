import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteLinesPanel } from "../src/components/quotes/cpq/QuoteLinesPanel";
import { he } from "../src/i18n/he";

describe("QuoteLinesPanel", () => {
  it("shows SKU column with editable מק״ט field", () => {
    render(
      <QuoteLinesPanel
        items={[
          {
            id: "i1",
            quote_id: "q1",
            description: "מצלמה IP",
            sku: "CAM-001",
            qty: 1,
            unit_price: 100,
            discount: 0,
            line_net: 100,
            item_type: "catalog",
          },
        ]}
        currency="ILS"
        canEdit
        canCatalog={false}
        catalogQ=""
        onCatalogQ={() => undefined}
        catalogResults={[]}
        catalogLoading={false}
        debouncedCatalogQ=""
        onAdd={() => undefined}
        onPersistLine={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );

    expect(screen.getByLabelText(he.quoteProductSku)).toBeTruthy();
    expect((screen.getByLabelText(he.quoteProductSku) as HTMLInputElement).value).toBe("CAM-001");
    expect(screen.getByLabelText(he.quoteItemDescription)).toBeTruthy();
  });
});

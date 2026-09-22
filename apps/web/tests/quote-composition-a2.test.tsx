import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteLinesPanel } from "../src/components/quotes/cpq/QuoteLinesPanel";
import { QuoteSectionDiscountField } from "../src/components/quotes/cpq/QuoteSectionDiscountField";
import { QuoteLineRow } from "../src/components/quotes/cpq/QuoteLineRow";
import { he } from "../src/i18n/he";

describe("A2 composition exposure", () => {
  it("renders note lines without priced commercial fields", () => {
    render(
      <QuoteLineRow
        item={{
          id: "n1",
          quote_id: "q1",
          description: "כולל אחריות שנה",
          qty: 1,
          unit_price: 0,
          line_net: 0,
          item_type: "note",
        }}
        currency="ILS"
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );

    expect(screen.getByLabelText(he.quoteAddNote)).toBeInTheDocument();
    expect(screen.queryByLabelText(he.quoteQty)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(he.quoteUnitPrice)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(he.quoteDiscountPercentLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(/₪/)).not.toBeInTheDocument();
  });

  it("labels labor lines as service/work", () => {
    render(
      <QuoteLineRow
        item={{
          id: "l1",
          quote_id: "q1",
          description: "התקנה",
          qty: 1,
          unit_price: 400,
          line_net: 400,
          item_type: "labor",
        }}
        currency="ILS"
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );
    expect(screen.getByText(he.quoteLaborBadge)).toBeInTheDocument();
  });

  it("exposes section discount editor and posts existing patch contract fields", () => {
    const onPersist = vi.fn();
    render(
      <QuoteSectionDiscountField
        section={{
          id: "s1",
          name: "מצלמות",
          sort_order: 10,
          discount_type: "percent",
          discount_value: 0,
        }}
        canEdit
        onPersist={onPersist}
      />,
    );

    fireEvent.change(screen.getByLabelText(he.quoteDiscountPercentLabel), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: he.cpqSectionDiscountApply }));
    expect(onPersist).toHaveBeenCalledWith({ discount_type: "percent", discount_value: 10 });
  });

  it("clears section discount via existing patch contract", () => {
    const onPersist = vi.fn();
    render(
      <QuoteSectionDiscountField
        section={{
          id: "s1",
          name: "מצלמות",
          sort_order: 10,
          discount_type: "amount",
          discount_value: 50,
        }}
        canEdit
        onPersist={onPersist}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: he.cpqSectionDiscountClear }));
    expect(onPersist).toHaveBeenCalledWith({ discount_type: "amount", discount_value: 0 });
  });

  it("wires section discount into lines panel composition surface", () => {
    const onPatch = vi.fn();
    render(
      <QuoteLinesPanel
        items={[
          {
            id: "i1",
            quote_id: "q1",
            description: "מצלמה",
            qty: 1,
            unit_price: 100,
            line_net: 100,
            item_type: "catalog",
            section_id: "s1",
          },
        ]}
        sections={[{ id: "s1", name: "מצלמות", sort_order: 10, discount_type: "percent", discount_value: 5 }]}
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
        onPatchSectionDiscount={onPatch}
      />,
    );

    expect(screen.getByText(he.cpqSectionDiscountActive("5%"))).toBeInTheDocument();
    expect(screen.getByLabelText(he.cpqSectionDiscount)).toBeInTheDocument();
  });
});

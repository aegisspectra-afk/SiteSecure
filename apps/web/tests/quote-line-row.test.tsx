import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteLineRow } from "../src/components/quotes/cpq/QuoteLineRow";
import { he } from "../src/i18n/he";

describe("QuoteLineRow", () => {
  it("keeps local draft while typing without remounting", async () => {
    const onPersist = vi.fn(async () => undefined);
    render(
      <QuoteLineRow
        item={{
          id: "i1",
          quote_id: "q1",
          description: "מצלמה",
          sku: "CAM-001",
          qty: 2,
          unit_price: 1000,
          discount: 0,
          discount_type: "percent",
          line_net: 2000,
          item_type: "catalog",
        }}
        currency="ILS"
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={onPersist}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );

    const desc = screen.getByLabelText(he.quoteItemDescription) as HTMLInputElement;
    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "NVR חדש" } });
    expect(desc.value).toBe("NVR חדש");
    expect(onPersist).not.toHaveBeenCalled();

    fireEvent.blur(desc);
    await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1));
    expect(onPersist).toHaveBeenCalledWith("i1", { description: "NVR חדש" });
  });

  it("allows clearing numeric field before typing a new value", () => {
    render(
      <QuoteLineRow
        item={{
          id: "i2",
          quote_id: "q1",
          description: "שורה",
          qty: 8,
          unit_price: 8500,
          discount: 0,
          line_net: 68000,
          item_type: "free",
        }}
        currency="ILS"
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={vi.fn(async () => undefined)}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );

    const qty = screen.getByLabelText(he.quoteQty) as HTMLInputElement;
    fireEvent.focus(qty);
    fireEvent.change(qty, { target: { value: "" } });
    expect(qty.value).toBe("");
    fireEvent.change(qty, { target: { value: "10" } });
    expect(qty.value).toBe("10");
  });
});

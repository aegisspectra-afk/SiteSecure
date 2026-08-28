import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuoteLineRow } from "../src/components/quotes/cpq/QuoteLineRow";
import { he } from "../src/i18n/he";
import type { QuoteItemOut } from "@site-secure/api-client";

const baseItem: QuoteItemOut = {
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
};

function renderRow(
  props: Partial<ComponentProps<typeof QuoteLineRow>> & {
    item?: QuoteItemOut;
    onPersist?: (itemId: string, body: Record<string, unknown>) => Promise<void>;
  } = {},
) {
  const onPersist = props.onPersist ?? vi.fn(async () => undefined);
  return {
    onPersist,
    ...render(
      <QuoteLineRow
        item={props.item ?? baseItem}
        currency="ILS"
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={onPersist}
        onDelete={() => undefined}
        onReorder={() => undefined}
        {...props}
      />,
    ),
  };
}

describe("QuoteLineRow", () => {
  it("keeps local draft while typing without remounting", async () => {
    const { onPersist } = renderRow();

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
    renderRow({
      item: {
        ...baseItem,
        id: "i2",
        description: "שורה",
        qty: 8,
        unit_price: 8500,
        line_net: 68000,
        item_type: "free",
      },
    });

    const qty = screen.getByLabelText(he.quoteQty) as HTMLInputElement;
    fireEvent.focus(qty);
    fireEvent.change(qty, { target: { value: "" } });
    expect(qty.value).toBe("");
    fireEvent.change(qty, { target: { value: "10" } });
    expect(qty.value).toBe("10");
  });

  it("updates SKU immediately while typing", () => {
    renderRow();
    const sku = screen.getByLabelText(he.quoteProductSku) as HTMLInputElement;
    fireEvent.focus(sku);
    fireEvent.change(sku, { target: { value: "DS-7616" } });
    expect(sku.value).toBe("DS-7616");
  });

  it("updates discount while typing partial values", () => {
    renderRow();
    const discount = screen.getByLabelText(he.quoteDiscountPercentLabel) as HTMLInputElement;
    fireEvent.focus(discount);
    fireEvent.change(discount, { target: { value: "" } });
    expect(discount.value).toBe("");
    fireEvent.change(discount, { target: { value: "1" } });
    expect(discount.value).toBe("1");
    fireEvent.change(discount, { target: { value: "10" } });
    expect(discount.value).toBe("10");
  });

  it("persists blurred field when tabbing to another field on the same row", async () => {
    const onPersist = vi.fn(async () => undefined);
    renderRow({ onPersist });

    const desc = screen.getByLabelText(he.quoteItemDescription) as HTMLInputElement;
    const qty = screen.getByLabelText(he.quoteQty) as HTMLInputElement;

    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "מצלמת Hikvision 4MP" } });
    fireEvent.blur(desc);
    fireEvent.focus(qty);

    await waitFor(() =>
      expect(onPersist).toHaveBeenCalledWith("i1", { description: "מצלמת Hikvision 4MP" }),
    );
  });

  it("does not let stale server props overwrite newer local typing", async () => {
    function Harness() {
      const [item, setItem] = useState(baseItem);
      const onPersist = vi.fn(async (_id: string, body: { description?: string }) => {
        await new Promise((r) => setTimeout(r, 30));
        setItem((prev) => ({ ...prev, description: body.description ?? prev.description }));
      });
      return (
        <QuoteLineRow
          item={item}
          currency="ILS"
          canEdit
          globalIndex={0}
          rowCount={1}
          onPersist={onPersist}
          onDelete={() => undefined}
          onReorder={() => undefined}
        />
      );
    }

    render(<Harness />);
    const desc = screen.getByLabelText(he.quoteItemDescription) as HTMLInputElement;

    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "מצלמת Hikvision" } });
    fireEvent.blur(desc);

    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "מצלמת Hikvision 4MP" } });
    expect(desc.value).toBe("מצלמת Hikvision 4MP");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(desc.value).toBe("מצלמת Hikvision 4MP");
  });

  it("keeps typed value while a background save completes for another field", async () => {
    const onPersist = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    renderRow({ onPersist });

    const desc = screen.getByLabelText(he.quoteItemDescription) as HTMLInputElement;
    const sku = screen.getByLabelText(he.quoteProductSku) as HTMLInputElement;

    fireEvent.focus(sku);
    fireEvent.change(sku, { target: { value: "SKU-NEW" } });
    fireEvent.blur(sku);

    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "טקסט חדש" } });
    expect(desc.value).toBe("טקסט חדש");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(desc.value).toBe("טקסט חדש");
  });

  it("survives parent item refresh with unchanged editable fields", () => {
    function Harness() {
      const [item, setItem] = useState(baseItem);
      return (
        <>
          <QuoteLineRow
            item={item}
            currency="ILS"
            canEdit
            globalIndex={0}
            rowCount={1}
            onPersist={async () => undefined}
            onDelete={() => undefined}
            onReorder={() => undefined}
          />
          <button type="button" onClick={() => setItem((prev) => ({ ...prev, line_net: 1800 }))}>
            refresh totals
          </button>
        </>
      );
    }

    render(<Harness />);
    const desc = screen.getByLabelText(he.quoteItemDescription) as HTMLInputElement;
    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "מצלמת Hikvision 4MP" } });
    fireEvent.click(screen.getByRole("button", { name: "refresh totals" }));
    expect(desc.value).toBe("מצלמת Hikvision 4MP");
  });
});

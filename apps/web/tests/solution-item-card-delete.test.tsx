import { act, fireEvent, render, screen } from "@testing-library/react";
import type { QuoteItemOut } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { SolutionItemCard } from "../src/components/quotes/cpq/SolutionItemCard";
import { he } from "../src/i18n/he";

const baseItem: QuoteItemOut = {
  id: "line-1",
  quote_id: "q1",
  description: "נדרש ציוד · מתג PoE",
  sku: "",
  qty: 1,
  unit_price: 0,
  discount: 0,
  discount_type: "amount",
  line_net: 0,
  item_type: "free",
  package_name: "cctv-planned:poe_switch",
};

describe("SolutionItemCard delete persist race", () => {
  it("does not flush a pending patch after delete unmount", async () => {
    vi.useFakeTimers();
    const onPersist = vi.fn(async () => undefined);
    const onDelete = vi.fn();

    const { unmount } = render(
      <SolutionItemCard
        item={baseItem}
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={onPersist}
        onDelete={onDelete}
        onReorder={() => undefined}
      />,
    );

    const qty = screen.getByLabelText(he.quoteQty) as HTMLInputElement;
    fireEvent.focus(qty);
    fireEvent.change(qty, { target: { value: "3" } });

    fireEvent.click(screen.getByRole("button", { name: he.quoteDeleteItem }));
    expect(onDelete).toHaveBeenCalledWith("line-1");

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(onPersist).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("still flushes pending edits when unmounting without delete (stage switch)", async () => {
    vi.useFakeTimers();
    const onPersist = vi.fn(async () => undefined);

    const { unmount } = render(
      <SolutionItemCard
        item={baseItem}
        canEdit
        globalIndex={0}
        rowCount={1}
        onPersist={onPersist}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );

    const qty = screen.getByLabelText(he.quoteQty) as HTMLInputElement;
    fireEvent.focus(qty);
    fireEvent.change(qty, { target: { value: "4" } });
    fireEvent.blur(qty);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onPersist).toHaveBeenCalledWith("line-1", { qty: 4 });
    vi.useRealTimers();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteLinesPanel } from "../src/components/quotes/cpq/QuoteLinesPanel";
import { he } from "../src/i18n/he";
import type { QuoteLinePatch } from "../src/lib/quote-line-edit";

const catalogItem = {
  id: "i1",
  quote_id: "q1",
  description: "מצלמה IP",
  sku: "CAM-001",
  qty: 2,
  unit_price: 100,
  discount: 5,
  line_net: 190,
  item_type: "catalog",
  product_id: "p1",
};

const laborItem = {
  id: "i2",
  quote_id: "q1",
  description: "התקנה והגדרה",
  sku: "",
  qty: 1,
  unit_price: 250,
  discount: 0,
  line_net: 250,
  item_type: "labor",
};

function renderPanel(
  mode: "planning" | "pricing",
  opts?: {
    items?: Array<typeof catalogItem | typeof laborItem>;
    onPersistLine?: (id: string, body: QuoteLinePatch) => Promise<void>;
    onGoToPlanning?: () => void;
    onOpenSystemBuilder?: () => void;
    onOpenQuickAdd?: () => void;
  },
) {
  return render(
    <QuoteLinesPanel
      items={opts?.items ?? [catalogItem, laborItem]}
      currency="ILS"
      canEdit
      canCatalog
      canOverridePrice
      catalogQ=""
      onCatalogQ={() => undefined}
      catalogResults={[]}
      catalogLoading={false}
      debouncedCatalogQ=""
      onAdd={() => undefined}
      onPersistLine={opts?.onPersistLine ?? (async () => undefined)}
      onDelete={() => undefined}
      onReorder={() => undefined}
      onOpenSystemBuilder={opts?.onOpenSystemBuilder}
      onOpenQuickAdd={opts?.onOpenQuickAdd}
      onAddSection={() => undefined}
      onGoToPlanning={opts?.onGoToPlanning}
      workspaceMode={mode}
    />,
  );
}

describe("Quote structural stage separation", () => {
  it("Stage 2 populated: solution cards, no unit price / discount / line total controls", () => {
    renderPanel("planning", {
      onOpenSystemBuilder: () => undefined,
      onOpenQuickAdd: () => undefined,
    });

    expect(screen.getByTestId("stage2-solution-workspace")).toBeTruthy();
    expect(screen.getByText(he.cpqStage2ItemsCount(2))).toBeTruthy();
    expect(screen.getByTestId("solution-equipment-bucket")).toBeTruthy();
    expect(screen.getByTestId("solution-services-bucket")).toBeTruthy();
    expect(screen.getAllByTestId("solution-item-card").length).toBe(2);

    expect(screen.queryByLabelText(he.quoteUnitPrice)).toBeNull();
    expect(screen.queryByLabelText(he.quoteDiscountLineLabel)).toBeNull();
    expect(screen.queryByText(he.cpqLineTotal)).toBeNull();
    expect(screen.queryByTestId("commercial-line-row")).toBeNull();

    expect(screen.getByRole("button", { name: he.cpqStage2CompactPlan })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.cpqStage2CompactCatalog })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.cpqStage2CompactItem })).toBeTruthy();
    expect(screen.getByRole("button", { name: he.cpqAddSection })).toBeTruthy();
    expect(screen.getByText(he.cpqSolutionFromCatalog)).toBeTruthy();
  });

  it("Stage 3 populated: commercial pricing controls and no composition launchers", () => {
    renderPanel("pricing", { onGoToPlanning: () => undefined });

    expect(screen.getByTestId("stage3-commercial-workspace")).toBeTruthy();
    expect(screen.getByText(he.cpqStage3ItemsCount(2))).toBeTruthy();
    expect(screen.getAllByTestId("commercial-line-row").length).toBe(2);
    expect(screen.getAllByLabelText(he.quoteUnitPrice).length).toBe(2);
    expect(screen.getAllByLabelText(he.quoteDiscountLineLabel).length).toBe(2);
    expect(screen.getAllByText(he.cpqLineTotal).length).toBe(2);

    expect(screen.queryByRole("button", { name: he.cpqStage2CompactPlan })).toBeNull();
    expect(screen.queryByRole("button", { name: he.cpqStage2CompactCatalog })).toBeNull();
    expect(screen.queryByRole("button", { name: he.cpqStage2CompactItem })).toBeNull();
    expect(screen.getByRole("button", { name: he.cpqStageBackToPlanning })).toBeTruthy();
    expect(screen.queryByTestId("solution-item-card")).toBeNull();
  });

  it("Stage 3 empty still points back to planning", () => {
    const onGo = vi.fn();
    renderPanel("pricing", { items: [], onGoToPlanning: onGo });
    expect(screen.getByTestId("stage3-empty")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: he.cpqStage3EmptyCta }));
    expect(onGo).toHaveBeenCalled();
    expect(screen.queryByText(he.cpqStage2CompactPlan)).toBeNull();
  });

  it("preserves dirty description across planning → pricing remount via flush", async () => {
    const onPersist = vi.fn(async (_id: string, _body: QuoteLinePatch) => undefined);
    const { rerender } = renderPanel("planning", { onPersistLine: onPersist });

    const desc = screen.getByLabelText(he.cpqSolutionEquipmentLabel) as HTMLInputElement;
    fireEvent.focus(desc);
    fireEvent.change(desc, { target: { value: "מצלמה מעודכנת" } });
    fireEvent.blur(desc);

    await waitFor(() => expect(onPersist).toHaveBeenCalled());
    expect(onPersist.mock.calls.some(([, body]) => body.description === "מצלמה מעודכנת")).toBe(true);

    rerender(
      <QuoteLinesPanel
        items={[{ ...catalogItem, description: "מצלמה מעודכנת" }, laborItem]}
        currency="ILS"
        canEdit
        canCatalog
        catalogQ=""
        onCatalogQ={() => undefined}
        catalogResults={[]}
        catalogLoading={false}
        debouncedCatalogQ=""
        onAdd={() => undefined}
        onPersistLine={onPersist}
        onDelete={() => undefined}
        onReorder={() => undefined}
        workspaceMode="pricing"
      />,
    );

    expect((screen.getAllByLabelText(he.quoteItemDescription)[0] as HTMLInputElement).value).toBe("מצלמה מעודכנת");
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { QuoteItemOut } from "@site-secure/api-client";
import { afterEach, describe, expect, it } from "vitest";
import { QuoteLineRow } from "../src/components/quotes/cpq/QuoteLineRow";
import { QuoteSummaryAside } from "../src/components/quotes/cpq/QuoteSummaryAside";
import { he } from "../src/i18n/he";
import { prefsFromSettings, prefsToSettingsPatch } from "../src/lib/workspace-prefs";

afterEach(() => cleanup());

const item = (over: Partial<QuoteItemOut> = {}): QuoteItemOut =>
  ({
    id: "i1",
    quote_id: "q1",
    description: "מצלמה",
    sku: "CAM-1",
    qty: 2,
    unit_price: 100,
    cost: 80,
    discount: 0,
    discount_type: "percent",
    line_net: 200,
    item_type: "catalog",
    ...over,
  }) as QuoteItemOut;

describe("B2 office profitability", () => {
  it("shows cost, profit and margin % on a line when canViewCost", () => {
    render(
      <QuoteLineRow
        item={item()}
        currency="ILS"
        canEdit={false}
        canViewCost
        marginMinimum={15}
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );
    expect(screen.getByText(he.quoteCost)).toBeInTheDocument();
    expect(screen.getByText(he.quoteGrossProfit)).toBeInTheDocument();
    // cost 160, net 200 → margin 20%
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("yellow-warns a line below workspace minimum without hiding sell price", () => {
    render(
      <QuoteLineRow
        item={item({ unit_price: 90, line_net: 180, cost: 80 })}
        currency="ILS"
        canEdit={false}
        canViewCost
        marginMinimum={15}
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );
    // cost 160, net 180 → ~11% < 15
    expect(screen.getByText(he.cpqLineMarginBelowMinimum)).toBeInTheDocument();
    expect(screen.getByText(he.quoteUnitPrice)).toBeInTheDocument();
  });

  it("hides office profitability from technicians (no canViewCost)", () => {
    render(
      <QuoteLineRow
        item={item()}
        currency="ILS"
        canEdit={false}
        canViewCost={false}
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );
    expect(screen.queryByText(he.quoteGrossProfit)).not.toBeInTheDocument();
    expect(screen.queryByText(he.cpqLineMarginBelowMinimum)).not.toBeInTheDocument();
  });

  it("summary below-minimum uses warning tone, not danger", () => {
    const { container } = render(
      <QuoteSummaryAside
        currency="ILS"
        vatPercent={17}
        subtotalNet={1000}
        vatAmount={170}
        totalGross={1170}
        canViewCost
        costTotal={900}
        marginAmount={100}
        marginPercent={10}
        marginStatus="critical"
        marginMinimum={15}
        marginTarget={30}
        pricedCount={1}
      />,
    );
    expect(container.querySelector(".text-warning")).toBeTruthy();
    expect(container.querySelector(".text-danger")).toBeNull();
    expect(screen.getByText(new RegExp(he.cpqMarginBelowMinimum))).toBeInTheDocument();
  });

  it("workspace prefs round-trip margin_minimum / margin_target", () => {
    const prefs = prefsFromSettings({
      quotes: { margin_minimum: 12, margin_target: 28, validity_days: 14 },
    } as never);
    expect(prefs.marginMinimumPercent).toBe(12);
    expect(prefs.marginTargetPercent).toBe(28);
    const patch = prefsToSettingsPatch(prefs);
    expect(patch.quotes?.margin_minimum).toBe(12);
    expect(patch.quotes?.margin_target).toBe(28);
  });
});

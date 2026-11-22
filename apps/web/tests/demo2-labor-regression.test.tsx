/**
 * DEMO_PATH_CHECK #2 regression: wizard service lines must never be «נדרש ציוד».
 * Commit 89b0094 fixed API send + new cctv-labor: lines; these cases cover UI paths that
 * regressed until labor was classified before catalog picks and legacy priced cctv-planned
 * lines were recognized as services (SolutionItemCard / isCctvPlannedQuoteItem).
 */
import type { QuoteItemOut } from "@site-secure/api-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SolutionItemCard, isSolutionServiceItem } from "../src/components/quotes/cpq/SolutionItemCard";
import { he } from "../src/i18n/he";
import { isCctvPlannedQuoteItem } from "../src/lib/cctv-recommend-projection";

function legacyPricedLaborLine(overrides: Partial<QuoteItemOut> = {}): QuoteItemOut {
  return {
    id: "line-labor",
    quote_id: "q1",
    description: "התקנת מצלמות · 3 שעות × ₪250",
    name: "התקנת מצלמות · 3 שעות × ₪250",
    sku: "",
    qty: 3,
    unit_price: 250,
    discount: 0,
    discount_type: "amount",
    line_net: 750,
    item_type: "free",
    package_name: "cctv-planned:installation_camera",
    ...overrides,
  };
}

describe("DEMO-2.2 labor regression — quote line classification", () => {
  it("legacy priced cctv-planned service is work, not a planned equipment gap", () => {
    const line = legacyPricedLaborLine();
    expect(isSolutionServiceItem(line)).toBe(true);
    expect(isCctvPlannedQuoteItem(line)).toBe(false);
  });

  it("cctv-labor package with item_type free still counts as service", () => {
    const line = legacyPricedLaborLine({
      item_type: "free",
      package_name: "cctv-labor:installation_camera",
    });
    expect(isSolutionServiceItem(line)).toBe(true);
    expect(isCctvPlannedQuoteItem(line)).toBe(false);
  });

  it("item_type labor is never planned equipment even with polluted description prefix", () => {
    const line = legacyPricedLaborLine({
      item_type: "labor",
      package_name: "cctv-labor:installation_camera",
      description: "נדרש ציוד · התקנת מצלמות · 3 שעות × ₪250",
    });
    expect(isSolutionServiceItem(line)).toBe(true);
    expect(isCctvPlannedQuoteItem(line)).toBe(false);
  });

  it("polluted description without package_name but hours × rate is still service", () => {
    const line = legacyPricedLaborLine({
      package_name: "",
      description: "נדרש ציוד · התקנת מצלמות · 3 שעות × ₪250",
    });
    expect(isSolutionServiceItem(line)).toBe(true);
    expect(isCctvPlannedQuoteItem(line)).toBe(false);
  });
});

describe("DEMO-2.2 labor regression — SolutionItemCard", () => {
  it("legacy priced service renders as service, not «נדרש ציוד»", () => {
    render(
      <SolutionItemCard
        item={legacyPricedLaborLine()}
        canEdit={false}
        globalIndex={0}
        rowCount={1}
        onPersist={async () => undefined}
        onDelete={() => undefined}
        onReorder={() => undefined}
      />,
    );
    const card = screen.getByTestId("solution-item-card");
    expect(card.getAttribute("data-item-kind")).toBe("service");
    expect(screen.queryByText(he.cpqCctvPlannedBadge)).not.toBeInTheDocument();
    expect(screen.getByText(he.quoteLaborBadge)).toBeInTheDocument();
  });
});
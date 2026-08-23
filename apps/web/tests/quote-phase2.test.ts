import { describe, expect, it } from "vitest";
import { isPriceOverride } from "../src/lib/quote-cpq";

describe("CPQ phase 2 helpers", () => {
  it("detects price override from catalog snapshot", () => {
    expect(
      isPriceOverride({
        id: "1",
        quote_id: "q",
        description: "Cam",
        qty: 1,
        unit_price: 690,
        item_type: "catalog",
        catalog_snapshot: { list_price: 750 },
      }),
    ).toBe(true);
    expect(
      isPriceOverride({
        id: "1",
        quote_id: "q",
        description: "Cam",
        qty: 1,
        unit_price: 750,
        item_type: "catalog",
        catalog_snapshot: { list_price: 750 },
      }),
    ).toBe(false);
  });
});

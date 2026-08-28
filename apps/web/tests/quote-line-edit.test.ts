import { describe, expect, it } from "vitest";
import {
  applyLineDiscount,
  coerceDraftNumber,
  dirtyLineFields,
  lineDraftFromItem,
  lineDraftToPatch,
  lineDraftToPatchForFields,
  previewLineNet,
} from "../src/lib/quote-line-edit";

describe("quote-line-edit", () => {
  const baseItem = {
    id: "i1",
    quote_id: "q1",
    description: "מצלמה",
    sku: "CAM-001",
    qty: 2,
    unit_price: 1000,
    discount: 0,
    discount_type: "percent",
    line_net: 2000,
    item_type: "catalog" as const,
  };

  it("allows empty numeric draft without coercing during edit", () => {
    const draft = lineDraftFromItem(baseItem);
    expect(draft.qty).toBe("2");
    expect(coerceDraftNumber("")).toBe(0);
    expect(coerceDraftNumber("8")).toBe(8);
  });

  it("calculates 10% line discount like backend", () => {
    expect(applyLineDiscount(2000, 10, "percent")).toBe(1800);
    const draft = { ...lineDraftFromItem(baseItem), discount: "10" };
    expect(previewLineNet(baseItem, draft)).toBe(1800);
  });

  it("calculates 20% and 100% discounts", () => {
    expect(applyLineDiscount(2000, 20, "percent")).toBe(1600);
    expect(applyLineDiscount(2000, 100, "percent")).toBe(0);
  });

  it("builds patch with percent discount_type", () => {
    const draft = { ...lineDraftFromItem(baseItem), discount: "10" };
    expect(lineDraftToPatch(draft, { ...baseItem, discount_type: "amount" })).toEqual({
      discount: 10,
      discount_type: "percent",
    });
  });

  it("detects description and sku changes", () => {
    const draft = {
      ...lineDraftFromItem(baseItem),
      description: "NVR חדש",
      sku: "DS-7616NXI-4T",
    };
    expect(lineDraftToPatch(draft, baseItem)).toEqual({
      description: "NVR חדש",
      sku: "DS-7616NXI-4T",
    });
  });

  it("returns null patch when nothing changed", () => {
    expect(lineDraftToPatch(lineDraftFromItem(baseItem), baseItem)).toBeNull();
  });

  it("builds partial patch for selected fields only", () => {
    const draft = {
      ...lineDraftFromItem(baseItem),
      description: "NVR חדש",
      sku: "DS-7616",
    };
    expect(lineDraftToPatchForFields(draft, baseItem, new Set(["description"]))).toEqual({
      description: "NVR חדש",
    });
  });

  it("tracks dirty fields independently", () => {
    const draft = {
      ...lineDraftFromItem(baseItem),
      description: "NVR חדש",
      qty: "5",
    };
    expect([...dirtyLineFields(draft, baseItem)]).toEqual(["description", "qty"]);
  });
});

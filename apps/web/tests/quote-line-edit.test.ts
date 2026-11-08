import { describe, expect, it } from "vitest";
import {
  applyLineDiscount,
  coerceDraftNumber,
  dirtyLineFields,
  lineDraftFromItem,
  lineDraftToPatch,
  lineDraftToPatchForFields,
  lineDiscountType,
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

  describe("stored ₪ amount discounts (templates, packages, CCTV apply)", () => {
    const amountItem = { ...baseItem, qty: 1, unit_price: 1000, discount: 50, discount_type: "amount", line_net: 950 };

    it("previews the line like the server: 1000 - ₪50 = 950, not 50%", () => {
      expect(lineDiscountType(amountItem)).toBe("amount");
      expect(previewLineNet(amountItem, lineDraftFromItem(amountItem))).toBe(950);
    });

    it("never marks an untouched amount discount dirty or patches it to percent", () => {
      const draft = lineDraftFromItem(amountItem);
      expect(lineDraftToPatch(draft, amountItem)).toBeNull();
      expect(dirtyLineFields(draft, amountItem).has("discount")).toBe(false);
      const qtyOnly = { ...draft, qty: "2" };
      expect(lineDraftToPatch(qtyOnly, amountItem)).toEqual({ qty: 2 });
    });

    it("keeps the stored unit when the amount is edited", () => {
      const draft = { ...lineDraftFromItem(amountItem), discount: "60" };
      expect(lineDraftToPatch(draft, amountItem)).toEqual({ discount: 60, discount_type: "amount" });
      expect(previewLineNet(amountItem, draft)).toBe(940);
    });

    it("a new discount on a line without one is a percent", () => {
      const noDiscount = { ...amountItem, discount: 0 };
      expect(lineDiscountType(noDiscount)).toBe("percent");
      const draft = { ...lineDraftFromItem(noDiscount), discount: "10" };
      expect(lineDraftToPatch(draft, noDiscount)).toEqual({ discount: 10, discount_type: "percent" });
      expect(previewLineNet(noDiscount, draft)).toBe(900);
    });
  });

  describe("lines that carry only a name (manual/API lines)", () => {
    const named = { ...baseItem, description: "", name: "שירות בדיקה" };

    it("shows the same text the customer document shows", () => {
      expect(lineDraftFromItem(named).description).toBe("שירות בדיקה");
    });

    it("does not save anything just because the line was opened", () => {
      expect(lineDraftToPatch(lineDraftFromItem(named), named)).toBeNull();
      expect(dirtyLineFields(lineDraftFromItem(named), named).size).toBe(0);
    });

    it("an edit is saved as the description the document will show", () => {
      const draft = { ...lineDraftFromItem(named), description: "שירות בדיקה שנתי" };
      expect(lineDraftToPatch(draft, named)).toEqual({ description: "שירות בדיקה שנתי" });
    });
  });
});


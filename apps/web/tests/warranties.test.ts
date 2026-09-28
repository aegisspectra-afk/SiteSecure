import { describe, expect, it } from "vitest";
import type { WarrantyOut } from "@site-secure/api-client";
import { he } from "../src/i18n/he";
import {
  equipmentOptionLabel,
  filterWarrantiesLocal,
  warrantyRowMeta,
  warrantyRowTitle,
  warrantyStatusLabel,
  warrantyStatusTone,
  warrantyTypeLabel,
} from "../src/lib/warranties";

function row(partial: Partial<WarrantyOut> = {}): WarrantyOut {
  return {
    id: "w1",
    workspace_id: "ws1",
    number: "W-00012",
    type: "installation",
    status: "active",
    customer_id: "c1",
    site_id: "s1",
    equipment_id: "e1",
    customer_name: "אלון בע״מ",
    site_name: "משרד ראשי",
    equipment_name: "מצלמה",
    equipment_manufacturer: "Hikvision",
    equipment_model: "DS-2",
    equipment_serial: "SN-42",
    starts_on: "2026-01-01",
    ends_on: "2027-01-01",
    created_at: "2026-09-27T00:00:00Z",
    updated_at: "2026-09-27T00:00:00Z",
    ...partial,
  };
}

describe("warranties helpers", () => {
  it("maps status labels and tones", () => {
    expect(warrantyStatusLabel("active")).toBe(he.warrantyStatuses.active);
    expect(warrantyStatusTone("active")).toBe("success");
    expect(warrantyStatusTone("expiring_soon")).toBe("warning");
    expect(warrantyStatusTone("expired")).toBe("danger");
    expect(warrantyStatusTone("cancelled")).toBe("neutral");
    expect(warrantyTypeLabel("manufacturer")).toBe(he.warrantyTypes.manufacturer);
  });

  it("builds list title/meta with customer site serial", () => {
    expect(warrantyRowTitle(row())).toContain("W-00012");
    expect(warrantyRowTitle(row())).toContain("Hikvision");
    const meta = warrantyRowMeta(row());
    expect(meta).toContain("אלון בע״מ");
    expect(meta).toContain("משרד ראשי");
    expect(meta).toContain("SN-42");
  });

  it("filters locally over loaded fields only", () => {
    const items = [
      row(),
      row({
        id: "w2",
        number: "W-00099",
        customer_name: "אחר",
        equipment_serial: "ZZ-1",
        equipment_manufacturer: null,
        equipment_model: null,
        equipment_name: null,
      }),
    ];
    expect(filterWarrantiesLocal(items, "SN-42")).toHaveLength(1);
    expect(filterWarrantiesLocal(items, "אלון")).toHaveLength(1);
    expect(filterWarrantiesLocal(items, "W-000")).toHaveLength(2);
    expect(filterWarrantiesLocal(items, "לא-קיים")).toHaveLength(0);
  });

  it("formats equipment picker labels", () => {
    expect(
      equipmentOptionLabel({
        name: "NVR",
        manufacturer: "Dahua",
        model: "XVR",
        serial: "ABC",
      }),
    ).toBe("NVR — Dahua XVR · ABC");
  });
});

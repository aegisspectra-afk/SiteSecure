import {
  assignableInviteRoles,
  defaultPlanKey,
  planHasCapability,
  planHasFeature,
  planLabel,
  planLabelEn,
  seatLimitReached,
  seatUsage,
} from "@site-secure/authz";

describe("catalog entitlements", () => {
  it("defaults self-serve workspaces to free (solo alias → Free)", () => {
    expect(defaultPlanKey()).toBe("free");
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("solo")).toBe("Free");
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel("business")).toBe("Business");
    expect(planLabel("enterprise")).toBe("Enterprise");
    expect(planLabelEn("solo")).toBe("Free");
    expect(planLabelEn("business")).toBe("Business");
    expect(planHasFeature("solo", "inventory")).toBe(false);
    expect(planHasFeature("business", "inventory")).toBe(true);
  });

  it("Free assignable roles exclude technicians; Business includes them", () => {
    expect(assignableInviteRoles("free")).toEqual(["viewer"]);
    expect(assignableInviteRoles("solo")).toEqual(["viewer"]);
    expect(assignableInviteRoles("pro")).not.toContain("technician");
    expect(assignableInviteRoles("business")).toContain("technician");
    expect(assignableInviteRoles("business")).toContain("manager");
  });

  it("reads §8 seat/storage caps from the catalog", () => {
    const freeOwner = seatUsage("free", ["owner"]);
    const office = freeOwner.find((row) => row.key === "seats_operator");
    const field = freeOwner.find((row) => row.key === "seats_field");
    expect(office).toMatchObject({ current: 1, limit: 1, unlimited: false });
    // seats_field 0 → unlimited flag in legacy meter; technicians gated by capability
    expect(field).toMatchObject({ current: 0, limit: 0, unlimited: true });
    expect(seatLimitReached("enterprise", "technician", ["owner", "technician"])).toBe(false);
  });

  it("exposes §8 capabilities: Free off, Pro mid, Business full", () => {
    expect(planHasCapability("free", "quotes.alternatives")).toBe(false);
    expect(planHasCapability("solo", "comms.whatsapp")).toBe(false);
    expect(planHasCapability("pro", "quotes.alternatives")).toBe(true);
    expect(planHasCapability("pro", "field.dispatch")).toBe(false);
    expect(planHasCapability("business", "field.technicians")).toBe(true);
    expect(planHasCapability("business", "quotes.profitability")).toBe(true);
  });
});

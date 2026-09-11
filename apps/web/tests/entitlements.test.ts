import {
  assignableInviteRoles,
  defaultPlanKey,
  planHasFeature,
  planLabel,
  planLabelEn,
  seatLimitReached,
  seatUsage,
} from "@site-secure/authz";

describe("catalog entitlements", () => {
  it("defaults self-serve workspaces to solo (public label Free)", () => {
    expect(defaultPlanKey()).toBe("solo");
    expect(planLabel("solo")).toBe("Free");
    expect(planLabel("business")).toBe("Pro");
    expect(planLabel("enterprise")).toBe("Enterprise");
    expect(planLabelEn("solo")).toBe("Free");
    expect(planLabelEn("business")).toBe("Pro");
    expect(planHasFeature("solo", "inventory")).toBe(false);
    expect(planHasFeature("business", "inventory")).toBe(true);
  });

  it("does not let Free (solo) invite office roles", () => {
    expect(assignableInviteRoles("solo")).toEqual(["technician", "viewer"]);
    expect(assignableInviteRoles("business")).toContain("manager");
  });

  it("reads seat caps from the catalog instead of hardcoded fives", () => {
    const soloOwner = seatUsage("solo", ["owner"]);
    const office = soloOwner.find((row) => row.key === "seats_operator");
    const field = soloOwner.find((row) => row.key === "seats_field");
    expect(office).toMatchObject({ current: 1, limit: 1, unlimited: false });
    expect(field).toMatchObject({ current: 0, limit: 3, unlimited: false });
    expect(seatLimitReached("solo", "technician", ["owner"])).toBe(false);
    expect(seatLimitReached("solo", "technician", ["owner", "technician", "technician", "viewer"])).toBe(true);
    expect(seatLimitReached("enterprise", "technician", ["owner", "technician"])).toBe(false);
  });
});

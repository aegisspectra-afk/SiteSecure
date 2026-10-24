import { describe, expect, it } from "vitest";
import { splitWorkforceMobileNav, workforceNavDestinations, workforceNavItems } from "./nav";

describe("workforce navigation", () => {
  it("shows ops, requests and self for a full entitled owner", () => {
    const opts = {
      roleKey: "owner",
      features: ["workforce"],
      permissions: ["*"],
    };
    expect(workforceNavDestinations(opts)).toEqual([
      "/",
      "/schedules",
      "/employees",
      "/sites",
      "/positions",
      "/time-off",
      "/my-shifts",
      "/profile",
      "/reports",
      "/settings",
    ]);
  });

  it("hides the module when the feature is off", () => {
    expect(workforceNavDestinations({ roleKey: "owner", features: ["core"], permissions: ["*"] })).toEqual([]);
  });

  it("workforce member sees portal and profile only", () => {
    expect(
      workforceNavDestinations({
        roleKey: "workforce_member",
        features: ["workforce"],
        permissions: ["settings.view", "workforce.portal.view"],
      }),
    ).toEqual(["/my-shifts", "/profile"]);
  });

  it("lists sites, positions and schedules when entitled, but not optimizer", () => {
    const paths = workforceNavDestinations({
      roleKey: "administrator",
      features: ["workforce"],
      permissions: [
        "workforce.view",
        "workforce.employees.view",
        "workforce.sites.view",
        "workforce.schedules.view",
        "workforce.schedules.edit",
      ],
    });
    expect(paths).toContain("/sites");
    expect(paths).toContain("/positions");
    expect(paths).toContain("/schedules");
    expect(paths).toContain("/time-off");
    expect(paths).not.toContain("/optimize");
    expect(paths).not.toContain("/reports");
    expect(paths).not.toContain("/settings");
  });

  it("viewer without sites.view does not see the sites admin page", () => {
    const paths = workforceNavDestinations({
      roleKey: "viewer",
      features: ["workforce"],
      permissions: ["workforce.view", "workforce.employees.view", "workforce.schedules.view", "workforce.portal.view"],
    });
    expect(paths).toEqual(["/", "/schedules", "/employees", "/positions", "/time-off", "/my-shifts", "/profile"]);
  });

  it("keeps a short portal nav intact on mobile", () => {
    const items = workforceNavItems({
      roleKey: "workforce_member",
      features: ["workforce"],
      permissions: ["settings.view", "workforce.portal.view"],
    });
    expect(splitWorkforceMobileNav(items)).toEqual({
      primary: items,
      overflow: [],
    });
  });

  it("pins dashboard, schedules, employees and my-shifts on the mobile bar", () => {
    const items = workforceNavItems({
      roleKey: "owner",
      features: ["workforce"],
      permissions: ["*"],
    });
    const split = splitWorkforceMobileNav(items);
    expect(split.primary.map((item) => item.to)).toEqual(["/", "/schedules", "/employees", "/my-shifts"]);
    expect(split.overflow.map((item) => item.to)).toContain("/sites");
    expect(split.overflow.map((item) => item.to)).toContain("/settings");
  });
});

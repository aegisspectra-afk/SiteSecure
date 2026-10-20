import { describe, expect, it } from "vitest";
import { workforceBottomNav, workforceNavDestinations } from "../src/lib/workforce-nav";

describe("workforce navigation", () => {
  it("shows dashboard and employees when entitled", () => {
    const opts = {
      roleKey: "owner",
      features: ["workforce"],
      permissions: ["*"],
    };
    expect(workforceNavDestinations(opts)).toEqual([
      "/app/workforce",
      "/app/workforce/employees",
      "/app/workforce/sites",
      "/app/workforce/positions",
      "/app/workforce/schedules",
    ]);
    expect(workforceBottomNav(opts).map((item) => (item.kind === "route" ? item.to : item.kind))).toEqual([
      "/app/workforce",
      "/app/workforce/employees",
      "/app/workforce/sites",
      "/app/workforce/positions",
      "/app/workforce/schedules",
    ]);
  });

  it("hides the module when the feature is off", () => {
    expect(
      workforceNavDestinations({ roleKey: "owner", features: ["core"], permissions: ["*"] }),
    ).toEqual([]);
  });

  it("workforce member sees portal only", () => {
    expect(
      workforceNavDestinations({
        roleKey: "workforce_member",
        features: ["workforce"],
        permissions: ["settings.view", "workforce.portal.view"],
      }),
    ).toEqual(["/app/workforce"]);
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
    expect(paths).toContain("/app/workforce/sites");
    expect(paths).toContain("/app/workforce/positions");
    expect(paths).toContain("/app/workforce/schedules");
    expect(paths).not.toContain("/app/workforce/optimize");
  });

  it("viewer without sites.view does not see the sites admin page", () => {
    const paths = workforceNavDestinations({
      roleKey: "viewer",
      features: ["workforce"],
      permissions: ["workforce.view", "workforce.employees.view", "workforce.schedules.view", "workforce.portal.view"],
    });
    expect(paths).toEqual([
      "/app/workforce",
      "/app/workforce/employees",
      "/app/workforce/positions",
      "/app/workforce/schedules",
    ]);
  });
});

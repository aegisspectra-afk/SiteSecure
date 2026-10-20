import { describe, expect, it } from "vitest";
import { afterAuthPath } from "../src/lib/auth-routes";
import { homeVariant } from "../src/lib/home";
import { needsPlatformSetup } from "../src/lib/platform-setup";

describe("Site Secure public onboarding routing", () => {
  it("sends users with a workspace to Aegis Platform Home, not platform-path", () => {
    expect(afterAuthPath(true)).toBe("/platform");
    expect(afterAuthPath(false)).toBe("/onboarding");
  });

  it("does not gate owners into product setup after workspace create", () => {
    expect(needsPlatformSetup({ workspaceId: "ws-new", roleKey: "owner" })).toBe(false);
  });

  it("keeps technician home variant separate from owner ops", () => {
    expect(homeVariant("technician")).toBe("today");
    expect(homeVariant("owner")).toBe("ops");
  });
});

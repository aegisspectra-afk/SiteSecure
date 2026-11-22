import { describe, expect, it } from "vitest";
import { landingPathForSession } from "../src/lib/auth-routes";

const SS = ["core", "crm", "quotes", "projects", "service"];
const one = (features: string[] = SS) => [{ features }];

describe("DEMO-3.4 landing after login", () => {
  it("an owner or any user of a single Site Secure workspace goes to /app or /app/today", () => {
    expect(landingPathForSession({ has_workspace: true, memberships: one() })).toBe("/app");
    expect(landingPathForSession({ has_workspace: true, is_platform_admin: false, memberships: one() })).toBe("/app");
    expect(
      landingPathForSession({
        has_workspace: true,
        memberships: [{ features: SS, role_key: "technician" }],
      }),
    ).toBe("/app/today");
  });

  it("/platform only for platform admins and users with several workspaces", () => {
    expect(landingPathForSession({ has_workspace: true, is_platform_admin: true, memberships: one() })).toBe("/platform");
    expect(landingPathForSession({ has_workspace: true, memberships: [...one(), ...one()] })).toBe("/platform");
  });

  it("a single workspace without Site Secure (e.g. SSP only) gets the product picker, not a locked shell", () => {
    expect(landingPathForSession({ has_workspace: true, memberships: one(["ssp"]) })).toBe("/platform");
  });

  it("no workspace -> onboarding; a safe invite deep link still wins", () => {
    expect(landingPathForSession({ has_workspace: false, memberships: [] })).toBe("/onboarding");
    expect(landingPathForSession(null)).toBe("/onboarding");
    const invite = "/invite/abcdefghijklmnopqrstuv";
    expect(landingPathForSession({ has_workspace: true, memberships: one() }, invite)).toBe(invite);
    expect(landingPathForSession({ has_workspace: true, memberships: one() }, "https://evil.example")).toBe("/app");
  });
});

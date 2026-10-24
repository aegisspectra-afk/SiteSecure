import { describe, expect, it } from "vitest";
import {
  afterWorkforceLoginPath,
  membershipHasWorkforce,
  workforceGate,
} from "./access";

describe("workforce login gate", () => {
  it("keeps an entitled session on the WorkForce home", () => {
    expect(
      workforceGate({ loading: false, hasSession: true, hasWorkspace: true, hasWorkforce: true }),
    ).toBe("home");
    expect(afterWorkforceLoginPath("home")).toBe("/");
  });

  it("does not send an authenticated unentitled user into WorkForce data screens", () => {
    expect(
      workforceGate({ loading: false, hasSession: true, hasWorkspace: true, hasWorkforce: false }),
    ).toBe("blocked");
    expect(afterWorkforceLoginPath("blocked")).toBe("/login");
  });

  it("sends guests and expired sessions back to login", () => {
    expect(
      workforceGate({ loading: false, hasSession: false, hasWorkspace: true, hasWorkforce: true }),
    ).toBe("login");
    expect(afterWorkforceLoginPath("login")).toBe("/login");
  });

  it("waits while session hydrate is in flight", () => {
    expect(
      workforceGate({ loading: true, hasSession: false, hasWorkspace: false, hasWorkforce: false }),
    ).toBe("loading");
  });

  it("blocks a signed-in user with no workspace", () => {
    expect(
      workforceGate({ loading: false, hasSession: true, hasWorkspace: false, hasWorkforce: false }),
    ).toBe("no-workspace");
  });
});

describe("workforce entitlement from session", () => {
  it("requires the workforce feature on the active membership", () => {
    expect(membershipHasWorkforce(null)).toBe(false);
    expect(membershipHasWorkforce({ memberships: [] })).toBe(false);
    expect(membershipHasWorkforce({ memberships: [{ features: ["core", "crm"] }] })).toBe(false);
    expect(membershipHasWorkforce({ memberships: [{ features: ["core", "workforce"] }] })).toBe(true);
  });
});

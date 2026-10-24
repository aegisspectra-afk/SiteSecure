import { describe, expect, it } from "vitest";
import {
  sspCanChangePersonRole,
  sspCanDisablePerson,
  sspUserFiltersActive,
  sspUserOfficeTag,
  sspUserRoleTone,
  sspUsersListState,
} from "../src/lib/ssp-users-view";

describe("ssp users view", () => {
  it("blocks self-deactivation", () => {
    expect(sspCanDisablePerson("user-1", "user-1")).toBe(false);
    expect(sspCanDisablePerson("user-1", "user-2")).toBe(true);
    expect(sspCanDisablePerson(null, "user-2")).toBe(false);
  });

  it("blocks a manager from demoting their own admin role", () => {
    expect(
      sspCanChangePersonRole({
        actorUserId: "me",
        targetUserId: "me",
        currentRole: "org_admin",
        nextRole: "patrol_officer",
      }),
    ).toBe(false);
    expect(
      sspCanChangePersonRole({
        actorUserId: "me",
        targetUserId: "other",
        currentRole: "org_admin",
        nextRole: "patrol_officer",
      }),
    ).toBe(true);
    expect(
      sspCanChangePersonRole({
        actorUserId: "me",
        targetUserId: "me",
        currentRole: "org_admin",
        nextRole: "org_admin",
      }),
    ).toBe(true);
  });

  it("tags org-wide admins and unassigned field workers", () => {
    expect(sspUserOfficeTag({ role: "org_admin", siteCount: 0 })).toBe("org");
    expect(sspUserOfficeTag({ role: "patrol_officer", siteCount: 0 })).toBe("unassigned");
    expect(sspUserOfficeTag({ role: "patrol_officer", siteCount: 1 })).toBe("named");
    expect(sspUserOfficeTag({ role: "patrol_manager", siteCount: 0 })).toBe("unassigned");
    expect(sspUserRoleTone("org_admin")).toBe("admin");
    expect(sspUserRoleTone("patrol_officer")).toBe("officer");
  });

  it("defaults to an unfiltered list and treats a status filter as active", () => {
    expect(sspUserFiltersActive("", "", "", "")).toBe(false);
    expect(sspUserFiltersActive("", "", "", "active")).toBe(true);
    expect(
      sspUsersListState({ loading: false, error: false, itemCount: 0, filterActive: false }),
    ).toBe("empty");
    expect(
      sspUsersListState({ loading: false, error: false, itemCount: 0, filterActive: true }),
    ).toBe("no-results");
    expect(
      sspUsersListState({ loading: false, error: false, itemCount: 4, filterActive: false }),
    ).toBe("rows");
  });
});

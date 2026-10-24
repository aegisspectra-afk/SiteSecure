import { describe, expect, it } from "vitest";
import type { SessionMembership } from "@site-secure/api-client";
import { activeMembership, type ActiveMembershipSession } from "../src/lib/active-membership";

function membership(
  overrides: Partial<SessionMembership> & Pick<SessionMembership, "workspace_id">,
): SessionMembership {
  return {
    workspace_name: overrides.workspace_name ?? overrides.workspace_id,
    workspace_status: "active",
    role_key: "owner",
    technician_code: null,
    program_type: null,
    plan_key: "founding",
    features: ["core"],
    ...overrides,
  };
}

function session(input: {
  lastWorkspaceId?: string | null;
  memberships?: SessionMembership[];
}): ActiveMembershipSession {
  return {
    profile: { last_workspace_id: input.lastWorkspaceId },
    memberships: input.memberships,
  };
}

describe("activeMembership", () => {
  it("prefers the membership matching profile.last_workspace_id over list order", () => {
    const first = membership({ workspace_id: "ws-first", role_key: "technician" });
    const preferred = membership({ workspace_id: "ws-preferred", role_key: "owner" });
    const resolved = activeMembership(
      session({ lastWorkspaceId: "ws-preferred", memberships: [first, preferred] }),
    );
    expect(resolved).toBe(preferred);
    expect(resolved?.workspace_id).toBe("ws-preferred");
  });

  it("falls back to memberships[0] when the preferred workspace is stale", () => {
    const first = membership({ workspace_id: "ws-first", role_key: "technician" });
    const second = membership({ workspace_id: "ws-second", role_key: "owner" });
    const resolved = activeMembership(
      session({ lastWorkspaceId: "ws-gone", memberships: [first, second] }),
    );
    expect(resolved).toBe(first);
    expect(resolved?.workspace_id).toBe("ws-first");
  });

  it("falls back to memberships[0] when last_workspace_id is missing", () => {
    const first = membership({ workspace_id: "ws-only-first" });
    const second = membership({ workspace_id: "ws-second" });
    expect(activeMembership(session({ memberships: [first, second] }))).toBe(first);
    expect(
      activeMembership(session({ lastWorkspaceId: null, memberships: [first, second] })),
    ).toBe(first);
    expect(
      activeMembership({ memberships: [first, second] }),
    ).toBe(first);
  });

  it("leaves a single-workspace session unchanged", () => {
    const only = membership({ workspace_id: "ws-one", role_key: "owner" });
    expect(activeMembership(session({ lastWorkspaceId: "ws-one", memberships: [only] }))).toBe(only);
    expect(activeMembership(session({ lastWorkspaceId: "ws-stale", memberships: [only] }))).toBe(only);
    expect(activeMembership(session({ memberships: [only] }))).toBe(only);
  });

  it("returns undefined instead of inventing a membership", () => {
    expect(activeMembership(undefined)).toBeUndefined();
    expect(activeMembership(null)).toBeUndefined();
    expect(activeMembership(session({ lastWorkspaceId: "ws-preferred", memberships: [] }))).toBeUndefined();
    expect(activeMembership({ profile: { last_workspace_id: "ws-preferred" } })).toBeUndefined();
  });

  it("does not persist or mutate fallback workspace ids", () => {
    const first = membership({ workspace_id: "ws-first" });
    const payload = session({ lastWorkspaceId: "ws-gone", memberships: [first] });
    activeMembership(payload);
    expect(payload.profile?.last_workspace_id).toBe("ws-gone");
    expect(payload.memberships?.[0]).toBe(first);
  });
});

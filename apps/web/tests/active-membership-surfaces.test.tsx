import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { SessionMembership, SessionResponse } from "@site-secure/api-client";
import { Can } from "../src/components/Can";
import { useSettingsIdentity, useSettingsNavItems } from "../src/components/settings/SettingsShell";
import { activeMembership } from "../src/lib/active-membership";
import { appNav } from "../src/lib/app-nav";
import { can } from "../src/lib/can";
import { homeVariant } from "../src/lib/home";
import { he } from "../src/i18n/he";

const sessionState = vi.hoisted(() => ({
  current: null as SessionResponse | null,
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: sessionState.current,
    api: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("../src/lib/use-account-avatar", () => ({
  useAccountAvatar: () => "man",
}));

vi.mock("../src/lib/account-avatar", () => ({
  accountAvatarUrl: () => "/avatar.png",
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) => (
    <a href={to} className={className}>
      {children as never}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/app/settings" } }),
}));

function membership(
  overrides: Partial<SessionMembership> & Pick<SessionMembership, "workspace_id" | "role_key">,
): SessionMembership {
  return {
    workspace_name: overrides.workspace_name ?? overrides.workspace_id,
    workspace_status: "active",
    technician_code: null,
    program_type: null,
    plan_key: "founding",
    features: ["core", "settings", "crm", "quotes"],
    ...overrides,
  };
}

function makeSession(lastWorkspaceId: string | null, memberships: SessionMembership[]): SessionResponse {
  return {
    user_id: "user-1",
    email: "owner@example.com",
    profile: {
      id: "profile-1",
      full_name: "בדיקה",
      phone: null,
      locale: "he",
      last_workspace_id: lastWorkspaceId,
    },
    memberships,
    has_workspace: memberships.length > 0,
  };
}

function SettingsProbe() {
  const identity = useSettingsIdentity();
  const items = useSettingsNavItems();
  return (
    <div>
      <p data-testid="settings-workspace">{identity.workspace}</p>
      <p data-testid="settings-role">{identity.role}</p>
      <ul>
        {items
          .filter((item) => item.visible)
          .map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
      </ul>
    </div>
  );
}

afterEach(() => {
  cleanup();
  sessionState.current = null;
});

describe("active membership surfaces", () => {
  const tech = membership({
    workspace_id: "ws-tech",
    workspace_name: "סביבת טכנאי",
    role_key: "technician",
  });
  const owner = membership({
    workspace_id: "ws-owner",
    workspace_name: "סביבת בעלים",
    role_key: "owner",
  });

  it("Can gates on the preferred workspace, not memberships[0]", () => {
    sessionState.current = makeSession("ws-owner", [tech, owner]);
    render(
      <Can permission="users.view">
        <span>users-ok</span>
      </Can>,
    );
    expect(screen.getByText("users-ok")).toBeTruthy();
  });

  it("Can falls back to memberships[0] when the preferred workspace is stale", () => {
    sessionState.current = makeSession("ws-gone", [tech, owner]);
    render(
      <Can permission="users.view">
        <span>users-ok</span>
      </Can>,
    );
    expect(screen.queryByText("users-ok")).toBeNull();
  });

  it("settings identity and nav follow the preferred workspace", () => {
    sessionState.current = makeSession("ws-owner", [tech, owner]);
    render(<SettingsProbe />);
    expect(screen.getByTestId("settings-workspace").textContent).toBe("סביבת בעלים");
    expect(screen.getByTestId("settings-role").textContent).toBe("בעלים");
    expect(screen.getByText(he.settingsNavGeneral)).toBeTruthy();
    expect(screen.getByText(he.navUsers)).toBeTruthy();
  });

  it("settings stays technician-scoped when last_workspace_id is missing", () => {
    sessionState.current = makeSession(null, [tech]);
    render(<SettingsProbe />);
    expect(screen.getByTestId("settings-workspace").textContent).toBe("סביבת טכנאי");
    expect(screen.queryByText(he.settingsNavGeneral)).toBeNull();
    expect(screen.queryByText(he.navUsers)).toBeNull();
  });

  it("dashboard home variant follows the preferred membership role", () => {
    const preferred = makeSession("ws-owner", [tech, owner]);
    expect(homeVariant(activeMembership(preferred)?.role_key)).toBe("ops");
    const stale = makeSession("ws-gone", [tech, owner]);
    expect(homeVariant(activeMembership(stale)?.role_key)).toBe("today");
    const single = makeSession("ws-tech", [tech]);
    expect(homeVariant(activeMembership(single)?.role_key)).toBe("today");
  });

  it("AppShell nav and account gates use the preferred membership", () => {
    const preferred = activeMembership(makeSession("ws-owner", [tech, owner]));
    const groups = appNav(preferred?.role_key, preferred?.features ?? [], preferred?.permissions ?? null);
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.to));
    expect(hrefs).toContain("/app/dashboard");
    expect(hrefs).not.toContain("/app/today");
    expect(can(preferred?.role_key, "users.view", preferred?.features ?? [])).toBe(true);
  });
});

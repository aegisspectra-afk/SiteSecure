import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { he } from "../src/i18n/he";
import { isSettingsHubPath, isSettingsNavActive } from "../src/components/settings/SettingsShell";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/app/settings/general" } }),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      email: "owner@example.com",
      profile: { full_name: "בעלים בדיקה", phone: null },
      memberships: [
        {
          workspace_id: "ws1",
          workspace_name: "סביבת בדיקה",
          role_key: "owner",
          features: ["core", "settings", "team", "audit"],
        },
      ],
    },
  }),
}));

vi.mock("../src/lib/use-account-avatar", () => ({
  useAccountAvatar: () => "man",
}));

vi.mock("../src/lib/account-avatar", () => ({
  accountAvatarUrl: () => "/avatar.png",
}));

import { SettingsShell } from "../src/components/settings/SettingsShell";

describe("settings responsive shell", () => {
  it("marks settings hub and section paths correctly", () => {
    expect(isSettingsHubPath("/app/settings")).toBe(true);
    expect(isSettingsHubPath("/app/settings/")).toBe(true);
    expect(isSettingsHubPath("/app/settings/general")).toBe(false);
    expect(isSettingsNavActive("/app/settings", "/app/settings")).toBe(true);
    expect(isSettingsNavActive("/app/settings/company", "/app/settings")).toBe(false);
    expect(isSettingsNavActive("/app/settings/company", "/app/settings/company")).toBe(true);
    expect(isSettingsNavActive("/app/settings/general", "/app/settings/general")).toBe(true);
  });

  it("renders desktop rail profile and grouped nav", () => {
    render(
      <SettingsShell>
        <div>תוכן</div>
      </SettingsShell>,
    );
    expect(screen.getByTestId("settings-shell")).toBeTruthy();
    expect(screen.getByTestId("settings-nav-select")).toBeTruthy();
    expect(screen.getByTestId("settings-nav-desktop")).toBeTruthy();
    expect(screen.getByTestId("settings-rail-profile")).toBeTruthy();
    expect(screen.getAllByText(he.settingsTitle).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(he.settingsNavGroupProfile)).toBeTruthy();
    expect(screen.getByText(he.settingsNavGroupWorkspace)).toBeTruthy();
    expect(screen.getByText(he.settingsNavGroupCommercial)).toBeTruthy();
    expect(screen.getByText(he.settingsNavGroupOperations)).toBeTruthy();
    expect(screen.getByText(he.settingsNavGroupTeam)).toBeTruthy();
    expect(screen.getByText(he.settingsNavGroupAdvanced)).toBeTruthy();
    expect(screen.getAllByText(he.settingsNavSystem).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(he.settingsNavProfile).length).toBeGreaterThanOrEqual(1);
    const select = screen.getByTestId("settings-nav-select") as HTMLSelectElement;
    expect(select.querySelectorAll("optgroup").length).toBeGreaterThanOrEqual(4);
  });

  it("uses relative settings routes without localhost", () => {
    render(
      <SettingsShell>
        <div>תוכן</div>
      </SettingsShell>,
    );
    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || "");
    expect(hrefs.every((h) => h.startsWith("/app/settings"))).toBe(true);
    expect(hrefs.some((h) => h.includes("localhost") || h.includes("127.0.0.1"))).toBe(false);
  });
});

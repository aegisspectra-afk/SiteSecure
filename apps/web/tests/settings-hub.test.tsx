import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/app/settings" } }),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      email: "tech@example.com",
      profile: { full_name: "טכנאי בדיקה", phone: "0500000000" },
      memberships: [
        {
          workspace_id: "ws1",
          workspace_name: "סביבה",
          role_key: "technician",
          features: ["core", "settings"],
        },
      ],
    },
    api: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("../src/lib/use-account-avatar", () => ({
  useAccountAvatar: () => "man",
}));

vi.mock("../src/lib/account-avatar", () => ({
  accountAvatarUrl: () => "/avatar.png",
  ACCOUNT_AVATAR_IDS: ["man", "woman"],
  setAccountAvatarId: vi.fn(),
}));

import { SettingsHubRows, useSettingsNavGroups } from "../src/components/settings/SettingsShell";

function HubProbe() {
  const groups = useSettingsNavGroups();
  return (
    <div>
      <p>{he.settingsEditProfile}</p>
      <SettingsHubRows groups={groups} />
    </div>
  );
}

describe("settings hub IA", () => {
  it("shows personal rows for technician and hides workspace management", () => {
    render(<HubProbe />);
    expect(screen.getByText(he.settingsEditProfile)).toBeTruthy();
    expect(screen.getByText(he.settingsNavProfile)).toBeTruthy();
    expect(screen.queryByText(he.settingsNavAppearance)).toBeNull();
    expect(screen.queryByText(he.settingsNavGeneral)).toBeNull();
    expect(screen.queryByText(he.settingsNavQuotes)).toBeNull();
    expect(screen.queryByText(he.navUsers)).toBeNull();
    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || "");
    expect(hrefs).toContain("/app/settings/profile");
    expect(hrefs.every((h) => !h.includes("/app/settings/appearance"))).toBe(true);
    expect(hrefs.every((h) => !h.includes("localhost"))).toBe(true);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { he } from "../src/i18n/he";

const patchMe = vi.fn();
const refresh = vi.fn();

const sessionState = {
  full_name: "ישראל ישראלי",
  phone: "0501234567",
  email: "owner@example.com",
  role_key: "owner",
  workspace_name: "סביבת בדיקה",
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
}));

vi.mock("../src/components/settings/RequirePermission", () => ({
  RequirePermission: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../src/components/AccountAvatarPicker", () => ({
  AccountAvatarPicker: () => <div data-testid="avatar-picker-mock" />,
}));

vi.mock("../src/components/ThemePicker", () => ({
  ThemePicker: ({ id }: { id?: string }) => (
    <div data-testid="theme-picker-mock" data-id={id ?? ""}>
      theme
    </div>
  ),
}));

vi.mock("../src/lib/use-account-avatar", () => ({
  useAccountAvatar: () => "man",
}));

vi.mock("../src/lib/account-avatar", () => ({
  accountAvatarUrl: () => "/avatar.png",
  ACCOUNT_AVATAR_IDS: ["man", "woman"],
  setAccountAvatarId: vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      email: sessionState.email,
      profile: { full_name: sessionState.full_name, phone: sessionState.phone },
      memberships: [
        {
          workspace_id: "ws1",
          workspace_name: sessionState.workspace_name,
          role_key: sessionState.role_key,
          features: ["core", "settings", "team", "audit"],
        },
      ],
    },
    api: { patchMe },
    refresh,
  }),
}));

import { Route as ProfileRoute } from "../src/routes/app/settings/profile";

function renderProfile() {
  const Page = (ProfileRoute as unknown as { component: () => ReactNode }).component;
  return render(<Page />);
}

describe("PROFILE-SETTINGS-2 profile polish", () => {
  beforeEach(() => {
    sessionState.full_name = "ישראל ישראלי";
    sessionState.phone = "0501234567";
    sessionState.role_key = "owner";
    patchMe.mockReset();
    refresh.mockReset();
    patchMe.mockResolvedValue({});
    refresh.mockResolvedValue(undefined);
  });

  it("renders identity, sections, and account actions", () => {
    renderProfile();
    expect(screen.getByTestId("settings-profile")).toBeTruthy();
    expect(screen.getByText(he.settingsEditProfile)).toBeTruthy();
    expect(screen.getByText(he.settingsProfileLead)).toBeTruthy();
    expect(screen.getByText("ישראל ישראלי")).toBeTruthy();
    expect(screen.getAllByText("owner@example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(he.settingsProfilePersonalHeading)).toBeTruthy();
    expect(screen.getByText(he.settingsProfileAccountHeading)).toBeTruthy();
    expect(screen.getByText(he.settingsProfileSecurityHeading)).toBeTruthy();
    expect(screen.getByText(he.settingsProfileSecurityLink).closest("a")?.getAttribute("href")).toBe(
      "/app/settings/security",
    );
    expect(screen.getByText(he.securityPasswordResetCta).closest("a")?.getAttribute("href")).toBe(
      "/forgot-password",
    );
    expect(screen.getByText(he.accountAvatarChangeShort)).toBeTruthy();
    expect(screen.getByTestId("settings-profile-prefs")).toBeTruthy();
    expect(screen.getByText(he.settingsProfilePrefsHeading)).toBeTruthy();
    expect(screen.getByTestId("theme-picker-mock")).toBeTruthy();
    expect(screen.getByText(he.settingsProfileThemeDeviceHint)).toBeTruthy();
    const save = screen.getByRole("button", { name: he.settingsSaveChanges });
    expect(save).toBeDisabled();
  });

  it("shows empty-name fallback and hint", () => {
    sessionState.full_name = "";
    sessionState.phone = "";
    renderProfile();
    expect(screen.getByText(he.settingsProfileNamePlaceholder)).toBeTruthy();
    expect(screen.getByText(he.settingsProfileNameHint)).toBeTruthy();
    expect(screen.getByText(he.settingsProfilePhoneHint)).toBeTruthy();
  });

  it("enables save when dirty and persists via patchMe", async () => {
    renderProfile();
    const name = screen.getByLabelText(he.fullName) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "שם חדש" } });
    const save = screen.getByRole("button", { name: he.settingsSaveChanges });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(patchMe).toHaveBeenCalledWith({ full_name: "שם חדש", phone: "0501234567" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("hides security settings link for technician", () => {
    sessionState.role_key = "technician";
    renderProfile();
    expect(screen.queryByText(he.settingsProfileSecurityLink)).toBeNull();
    expect(screen.getByText(he.securityPasswordResetCta)).toBeTruthy();
  });
});

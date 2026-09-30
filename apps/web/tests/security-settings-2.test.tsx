import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { he } from "../src/i18n/he";
import { can } from "../src/lib/can";

const FULL_FEATURES = ["core", "settings", "team", "audit"];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    isLoading: false,
    isError: false,
    data: {
      workspace_id: "ws1",
      role_key: "owner",
      plan_key: "business",
      signals: [
        { key: "authentication", label_he: "אימות כניסה", status: "healthy", detail_he: "x" },
        { key: "rbac", label_he: "הרשאות וגישה", status: "healthy", detail_he: "x" },
        { key: "tenant_isolation", label_he: "בידוד", status: "healthy", detail_he: "x" },
        { key: "audit_logging", label_he: "יומן", status: "healthy", detail_he: "x" },
        { key: "api_security", label_he: "API", status: "healthy", detail_he: "x" },
        { key: "sessions", label_he: "סשנים", status: "not_built", detail_he: "x" },
        { key: "mfa", label_he: "MFA", status: "not_built", detail_he: "x" },
      ],
    },
  }),
}));

vi.mock("../src/components/lottie", () => ({
  LottieAnimation: () => null,
}));

vi.mock("../src/components/settings/RequirePermission", () => ({
  RequireAnyPermission: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const sessionState = {
  role_key: "owner" as string,
  features: FULL_FEATURES as string[],
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      email: "owner@example.com",
      profile: { full_name: "בעלים" },
      memberships: [
        {
          workspace_id: "ws1",
          workspace_name: "סביבת בדיקה",
          role_key: sessionState.role_key,
          features: sessionState.features,
        },
      ],
    },
    api: { getSecurityCenter: vi.fn() },
  }),
}));

import { Route as SecurityRoute } from "../src/routes/app/settings/security";

function renderSecurity() {
  const Page = (SecurityRoute as unknown as { component: () => ReactNode }).component;
  return render(<Page />);
}

describe("SECURITY-SETTINGS-2 account & access center", () => {
  beforeEach(() => {
    sessionState.role_key = "owner";
    sessionState.features = FULL_FEATURES;
  });

  it("renders user-facing hierarchy without primary JWT/RLS copy", () => {
    renderSecurity();
    expect(screen.getByTestId("settings-security")).toBeTruthy();
    expect(screen.getByText(he.securityStatusHeading)).toBeTruthy();
    expect(screen.getByText(he.securityAccountHeading)).toBeTruthy();
    expect(screen.getByText(he.securityAccessHeading)).toBeTruthy();
    expect(screen.getByText(he.securityProtectHeading)).toBeTruthy();
    expect(screen.getByText(he.securityStatusAuthTitle)).toBeTruthy();
    expect(screen.getByText(he.securityStatusMfaTitle)).toBeTruthy();
    expect(screen.getAllByText(he.securityChipUnavailable).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("owner@example.com")).toBeTruthy();
    expect(screen.getByTestId("settings-security-password").querySelector("a")?.getAttribute("href")).toBe(
      "/forgot-password",
    );
    const body = document.body.textContent || "";
    expect(body).not.toMatch(/JWT/);
    expect(body).not.toMatch(/authorize\(\)/);
    expect(body).not.toMatch(/הסתרת כפתור אינה אבטחה/);
    expect(screen.getByText(he.securityTechToggle)).toBeTruthy();
  });

  it("gates roles and audit links for owner", () => {
    renderSecurity();
    expect(screen.getByText(he.securityManageRolesCta).closest("a")?.getAttribute("href")).toBe(
      "/app/settings/roles",
    );
    expect(screen.getByTestId("settings-security-audit-link").getAttribute("href")).toBe("/app/settings/audit");
  });

  it("hides roles and audit CTAs for manager without those grants", () => {
    sessionState.role_key = "manager";
    renderSecurity();
    expect(can("manager", "roles.manage", FULL_FEATURES)).toBe(false);
    expect(can("manager", "audit.view", FULL_FEATURES)).toBe(false);
    expect(screen.queryByText(he.securityManageRolesCta)).toBeNull();
    expect(screen.queryByTestId("settings-security-audit-link")).toBeNull();
  });
});

describe("SECURITY-SETTINGS-2 copy honesty", () => {
  it("keeps unavailable MFA/sessions language and recovery CTA", () => {
    expect(he.securityLead).toContain("שחזור");
    expect(he.securityStatusSessionsBody).toContain("אינו זמין");
    expect(he.securityStatusMfaBody).toContain("אינו זמין");
    expect(he.securityPasswordResetCta).toBe("איפוס סיסמה");
    expect(he.securityTechBody).toMatch(/Row Level Security/);
  });
});

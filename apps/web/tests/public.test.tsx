import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PublicHome } from "../src/components/public/PublicHome";
import { pub } from "../src/i18n/public-he";
import { guestEntryPath } from "../src/lib/auth-routes";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    loading: false,
    user: null,
    session: null,
  }),
}));

describe("public website", () => {
  it("renders a product experience at home, not a login redirect", () => {
    render(<PublicHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(pub.heroLine1);
    expect(screen.getAllByRole("link", { name: pub.login }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: pub.joinPilot }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: pub.seeProduct })).toHaveAttribute("href", "#site-file");
    expect(document.getElementById("pain")).toBeTruthy();
    expect(document.getElementById("site-file")).toBeTruthy();
    expect(document.getElementById("twin")).toBeTruthy();
    expect(document.getElementById("operations")).toBeTruthy();
    expect(document.getElementById("field")).toBeTruthy();
    expect(document.getElementById("security")).toBeTruthy();
    expect(document.getElementById("pilot")).toBeTruthy();
    expect(screen.getAllByText(pub.previewBadge).length).toBeGreaterThan(0);
    expect(screen.getByText(pub.siteFileIntent)).toBeInTheDocument();
    expect(screen.getByText(pub.securityTitle)).toBeInTheDocument();
    expect(screen.queryByText("COMING SOON")).not.toBeInTheDocument();
  });

  it("keeps product entry at login when the app is unauthenticated", () => {
    expect(guestEntryPath()).toBe("/login");
  });
});

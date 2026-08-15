import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicHome } from "../src/components/public/PublicHome";
import { pub } from "../src/i18n/public-he";
import { legal } from "../src/i18n/legal-he";
import { guestEntryPath } from "../src/lib/auth-routes";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    hash,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    hash?: string;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    if (hash) href = `${href}#${hash}`;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => sessionStub,
}));

const sessionStub: {
  loading: boolean;
  user: { email: string } | null;
  session: { has_workspace: boolean; email?: string } | null;
  error: string | null;
  signOut: () => Promise<void>;
} = {
  loading: false,
  user: null,
  session: null,
  error: null,
  signOut: async () => undefined,
};

describe("public website", () => {
  beforeEach(() => {
    sessionStub.user = null;
    sessionStub.session = null;
    sessionStub.error = null;
  });

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
    expect(screen.getByRole("link", { name: legal.pages.privacy.title })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    expect(screen.getByRole("link", { name: legal.pages.terms.title })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: legal.pages.security.title })).toHaveAttribute(
      "href",
      "/legal/security",
    );
    expect(screen.queryByText("COMING SOON")).not.toBeInTheDocument();
  });

  it("keeps product entry at login when the app is unauthenticated", () => {
    expect(guestEntryPath()).toBe("/login");
  });

  it("names the signed-in account instead of an anonymous continue CTA", () => {
    sessionStub.user = { email: "ilya@example.com" };
    sessionStub.session = { has_workspace: false, email: "ilya@example.com" };
    sessionStub.error = null;
    render(<PublicHome />);
    expect(screen.getAllByText("ilya@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: pub.continueOnboarding }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: pub.signOut }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: pub.login })).not.toBeInTheDocument();
  });
});

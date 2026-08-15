import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LegalDocument } from "../src/components/public/LegalDocument";
import { legal, legalNav } from "../src/i18n/legal-he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    loading: false,
    user: null,
    session: null,
    error: null,
    signOut: async () => undefined,
  }),
}));

describe("legal pages", () => {
  it("renders each legal document with working sibling links", () => {
    for (const item of legalNav) {
      const page = legal.pages[item.slug];
      const { unmount } = render(<LegalDocument slug={item.slug} />);
      expect(screen.getByRole("heading", { level: 1, name: page.title })).toBeInTheDocument();
      expect(screen.getByText(page.lead)).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: legal.pages.privacy.title }).every((el) => el.getAttribute("href") === "/legal/privacy")).toBe(true);
      expect(screen.getAllByRole("link", { name: legal.pages.cookies.title }).every((el) => el.getAttribute("href") === "/legal/cookies")).toBe(true);
      expect(screen.getAllByRole("link", { name: legal.pages.disclaimer.title }).every((el) => el.getAttribute("href") === "/legal/disclaimer")).toBe(true);
      unmount();
    }
  });

  it("exposes real contact emails, not dead legal links", () => {
    const first = render(<LegalDocument slug="privacy" />);
    expect(screen.getByRole("link", { name: "privacy@aegis-spectra.com" })).toHaveAttribute(
      "href",
      "mailto:privacy@aegis-spectra.com",
    );
    first.unmount();
    render(<LegalDocument slug="security" />);
    expect(screen.getAllByRole("link", { name: "info@aegisspectra.co.il" })[0]).toHaveAttribute(
      "href",
      "mailto:info@aegisspectra.co.il",
    );
  });
});

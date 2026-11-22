import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
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

vi.mock("../src/components/public/PublicChrome", () => ({
  PublicHeader: () => <header data-testid="legal-header" />,
  PublicFooter: () => <footer data-testid="legal-footer" />,
}));

describe("legal pages", () => {
  it("renders each legal document with draft notice and sibling links", () => {
    for (const item of legalNav) {
      const page = legal.pages[item.slug];
      const { unmount } = render(<LegalDocument slug={item.slug} />);
      expect(screen.getByRole("note")).toHaveTextContent(legal.draftNotice);
      expect(screen.getByRole("heading", { level: 1, name: page.title })).toBeInTheDocument();
      expect(screen.getByText(page.lead)).toBeInTheDocument();
      expect(
        screen.getAllByRole("link", { name: legal.pages.privacy.title }).every((el) => el.getAttribute("href") === "/legal/privacy"),
      ).toBe(true);
      expect(
        screen.getAllByRole("link", { name: legal.pages.cancellation.title }).every(
          (el) => el.getAttribute("href") === "/legal/cancellation",
        ),
      ).toBe(true);
      expect(
        screen.getAllByRole("link", { name: legal.pages.accessibility.title }).every(
          (el) => el.getAttribute("href") === "/legal/accessibility",
        ),
      ).toBe(true);
      unmount();
    }
  });

  it("marks operator placeholders without inventing company ids", () => {
    render(<LegalDocument slug="privacy" />);
    expect(screen.getAllByText(/\[להשלמה\]/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/privacy@aegis-spectra.com/)).toBeNull();
  });
});
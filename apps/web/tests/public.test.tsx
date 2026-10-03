import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicHome } from "../src/components/public/PublicHome";
import { pubHe } from "../src/i18n/public-he";
import { pubEn } from "../src/i18n/public-en";
import { legal } from "../src/i18n/legal-he";
import { PUBLIC_LOCALE_STORAGE_KEY } from "../src/i18n/public";
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
    window.localStorage.removeItem(PUBLIC_LOCALE_STORAGE_KEY);
  });

  it("defaults to Hebrew product-led homepage", () => {
    render(<PublicHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(pubHe.heroLine1);
    expect(screen.getAllByRole("link", { name: pubHe.login }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: pubHe.joinPilot }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: pubHe.seeProduct })[0]).toHaveAttribute("href", "/#quotes");
    expect(document.getElementById("quotes")).toBeTruthy();
    expect(document.getElementById("flow")).toBeTruthy();
    expect(document.getElementById("site-file")).toBeTruthy();
    expect(document.getElementById("assets")).toBeTruthy();
    expect(document.getElementById("field")).toBeTruthy();
    expect(document.getElementById("friction")).toBeTruthy();
    expect(document.getElementById("security")).toBeTruthy();
    expect(document.getElementById("pilot")).toBeTruthy();
    expect(document.getElementById("intelligence")).toBeNull();
    expect(screen.getByText(pubHe.quoteA)).toBeInTheDocument();
    expect(screen.getByText(pubHe.securityTitleA)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: pubHe.heroShotAlt })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pubHe.securityCta })).toHaveAttribute("href", "/legal/security");
    expect(screen.getByRole("link", { name: legal.pages.privacy.title })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    expect(document.querySelector(".public-root")).toHaveAttribute("dir", "rtl");
  });

  it("switches homepage copy between Hebrew and English with the language control", async () => {
    const user = userEvent.setup();
    render(<PublicHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(pubHe.heroLine1);

    const english = screen.getAllByRole("radio", { name: /EN/i })[0];
    const header = document.querySelector("header.public-nav");
    expect(header).toHaveAttribute("dir", "rtl");
    await user.click(english);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(pubEn.heroLine1);
    expect(screen.getAllByRole("link", { name: pubEn.joinPilot }).length).toBeGreaterThan(0);
    expect(document.querySelector(".public-root")).toHaveAttribute("dir", "ltr");
    expect(header).toHaveAttribute("dir", "rtl");
    expect(window.localStorage.getItem(PUBLIC_LOCALE_STORAGE_KEY)).toBe("en");
  });

  it("exposes theme controls on the homepage that follow system preference", () => {
    render(<PublicHome />);
    const groups = screen.getAllByRole("radiogroup", { name: pubHe.themeLabel });
    expect(groups.length).toBeGreaterThan(0);
    const group = groups[0];
    expect(within(group).getByRole("radio", { name: pubHe.themeLight })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: pubHe.themeDark })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: pubHe.themeSystem })).toBeInTheDocument();
  });

  it("keeps product entry at login when the app is unauthenticated", () => {
    expect(guestEntryPath()).toBe("/login");
  });

  it("keeps signed-in workspace actions without showing email in the primary nav", () => {
    sessionStub.user = { email: "ilya@example.com" };
    sessionStub.session = { has_workspace: false, email: "ilya@example.com" };
    sessionStub.error = null;
    render(<PublicHome />);
    expect(screen.queryByText("ilya@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(pubHe.signedInAs))).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: pubHe.continueOnboarding }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: pubHe.signOut }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: pubHe.login })).not.toBeInTheDocument();
  });

  it("returns to guest login after sign-out instead of enter-workspace", () => {
    sessionStub.user = { email: "ilya@example.com" };
    sessionStub.session = { has_workspace: true, email: "ilya@example.com" };
    const { rerender } = render(<PublicHome />);
    expect(screen.getAllByRole("link", { name: pubHe.enterWorkspace }).length).toBeGreaterThan(0);

    sessionStub.user = null;
    sessionStub.session = null;
    rerender(<PublicHome />);
    expect(screen.queryByRole("link", { name: pubHe.enterWorkspace })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pubHe.signOut })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: pubHe.login }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: pubHe.joinPilot }).length).toBeGreaterThan(0);
  });
});

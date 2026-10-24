/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { he } from "../i18n/he";
import { LoginPage } from "./LoginPage";

const navigate = vi.fn();
const signIn = vi.fn();
const signOut = vi.fn();

let sessionStub = {
  loading: false,
  session: null as object | null,
  hasWorkspace: false,
  hasWorkforce: false,
  signIn,
  signOut,
};

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <span data-testid="navigate">{to}</span>,
  useNavigate: () => navigate,
}));

vi.mock("../lib/env", () => ({
  hasPublicSupabaseConfig: () => true,
  platformHomeUrl: () => "http://localhost:5173/platform",
  forgotPasswordUrl: () => "http://localhost:5173/forgot-password",
  openConfiguredUrl: vi.fn(),
}));

vi.mock("../lib/session", () => ({
  useSession: () => sessionStub,
}));

describe("WorkForce LoginPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockReset();
    signIn.mockReset();
    signOut.mockReset();
    sessionStub = {
      loading: false,
      session: null,
      hasWorkspace: false,
      hasWorkforce: false,
      signIn,
      signOut,
    };
  });

  it("renders a distinct workforce login and no public register", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("workforce-login")).toBeTruthy();
    expect(screen.getByText(he.loginKicker)).toBeTruthy();
    expect(screen.getByRole("heading", { name: he.loginLead })).toBeTruthy();
    expect(screen.queryByText(he.loginDescription)).toBeNull();
    expect(screen.queryByText(he.noRegister)).toBeNull();
    expect(screen.getByRole("link", { name: he.forgotPassword }).getAttribute("href")).toBe(
      "http://localhost:5173/forgot-password",
    );
    expect(screen.getByTestId("workforce-login-form")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /הרשמ|פיילוט|register/i })).toBeNull();
  });

  it("sends an entitled account to the WorkForce home", async () => {
    sessionStub.session = { user_id: "u1" };
    sessionStub.hasWorkspace = true;
    sessionStub.hasWorkforce = true;
    render(<LoginPage />);
    expect(screen.getByTestId("navigate").textContent).toBe("/");
  });

  it("keeps a signed-in unentitled account on login and offers sign-out", async () => {
    sessionStub.session = { user_id: "u1" };
    sessionStub.hasWorkspace = true;
    sessionStub.hasWorkforce = false;
    render(<LoginPage />);
    expect(screen.getByTestId("workforce-login-blocked")).toBeTruthy();
    expect(screen.getByText(he.entitlementBlockedTitle)).toBeTruthy();
    expect(screen.queryByTestId("navigate")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: he.signOut }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not route home when credentials succeed without workforce entitlement", async () => {
    signIn.mockResolvedValue({ ok: true, entitled: false });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(he.email), "user@example.com");
    await userEvent.type(screen.getByLabelText(he.password), "secret-pass");
    await userEvent.click(screen.getByTestId("workforce-login-form").querySelector("button[type='submit']")!);
    expect(signIn).toHaveBeenCalledWith("user@example.com", "secret-pass");
    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("routes home after an entitled sign-in", async () => {
    signIn.mockResolvedValue({ ok: true, entitled: true });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(he.email), "owner@example.com");
    await userEvent.type(screen.getByLabelText(he.password), "secret-pass");
    await userEvent.click(screen.getByTestId("workforce-login-form").querySelector("button[type='submit']")!);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthLayout } from "../src/components/AuthLayout";
import { LoginForm } from "../src/components/LoginForm";
import { RegisterForm } from "../src/components/RegisterForm";
import { he } from "../src/i18n/he";
import { authErrorMessage } from "../src/lib/auth-errors";
import { afterAuthPath, guestEntryPath } from "../src/lib/auth-routes";
import { requireProductionApiUrl } from "../src/lib/public-api-url";

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

describe("auth routing", () => {
  it("sends guests to login, never register", () => {
    expect(guestEntryPath()).toBe("/login");
    expect(guestEntryPath()).not.toBe("/register");
  });

  it("sends authenticated users to app or onboarding", () => {
    expect(afterAuthPath(true)).toBe("/app");
    expect(afterAuthPath(false)).toBe("/onboarding");
  });
});

describe("production API URL", () => {
  it("rejects localhost so Vercel never bakes in :8000", () => {
    expect(() => requireProductionApiUrl(undefined)).toThrow(/VITE_API_URL/);
    expect(() => requireProductionApiUrl("http://localhost:8000", true)).toThrow(/localhost/);
    expect(() => requireProductionApiUrl("http://127.0.0.1:8000", true)).toThrow(/localhost/);
    expect(requireProductionApiUrl("http://localhost:8000", false)).toBe("http://localhost:8000");
    expect(requireProductionApiUrl("https://api.example.com/")).toBe("https://api.example.com");
  });
});

describe("authErrorMessage", () => {
  it("maps known Supabase errors to Hebrew and hides raw English", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe(he.loginFailed);
    expect(authErrorMessage("Email not confirmed")).toBe(he.emailNotConfirmed);
    expect(authErrorMessage("User already registered")).toBe(he.userExists);
    expect(authErrorMessage("some unknown english failure")).toBe(he.authGenericError);
    expect(authErrorMessage("דוא״ל או סיסמה שגויים")).toBe("דוא״ל או סיסמה שגויים");
  });
});

describe("LoginForm", () => {
  it("keeps one Hebrew primary and a quieter forgot-password link", () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: he.loginPrimary })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.loginSecondaryForgot })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("button", { name: he.showPassword })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.loginSecondaryRegister })).not.toBeInTheDocument();
  });

  it("blocks submit with invalid email", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(he.email), "not-an-email");
    await user.type(screen.getByLabelText(he.password), "secret");
    await user.click(screen.getByRole("button", { name: he.loginPrimary }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(he.invalidEmail);
  });
});

describe("RegisterForm", () => {
  it("primary action is the Hebrew verb צור חשבון", () => {
    render(<RegisterForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: he.registerPrimary })).toBeInTheDocument();
    expect(screen.getByText(he.passwordMin)).toBeInTheDocument();
  });

  it("blocks short password and mismatched confirmation", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(he.fullName), "שם בדיקה");
    await user.type(screen.getByLabelText(he.email), "qa@sitesecure.test");
    await user.type(screen.getByLabelText(he.password), "short");
    await user.type(screen.getByLabelText(he.passwordConfirm), "short");
    await user.click(screen.getByRole("button", { name: he.registerPrimary }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((el) => el.textContent === he.passwordMin)).toBe(true);

    await user.clear(screen.getByLabelText(he.password));
    await user.clear(screen.getByLabelText(he.passwordConfirm));
    await user.type(screen.getByLabelText(he.password), "long-enough");
    await user.type(screen.getByLabelText(he.passwordConfirm), "does-not-match");
    await user.click(screen.getByRole("button", { name: he.registerPrimary }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(he.passwordMismatch)).toBeInTheDocument();
  });
});

describe("AuthLayout", () => {
  it("is a product entry screen with a Site File preview, not marketing bullets", () => {
    render(
      <AuthLayout title={he.loginTitle} welcome={he.authWelcome} description={he.loginLead}>
        <p>form</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("complementary", { name: he.brand })).toBeInTheDocument();
    expect(screen.getAllByText(he.brand).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.productLineRole).length).toBeGreaterThan(0);
    expect(screen.getByText(he.authTagline)).toBeInTheDocument();
    expect(screen.getByText(he.authWelcome)).toBeInTheDocument();
    expect(screen.getAllByLabelText(he.authPreviewAria).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.authPreviewProduct).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.authPreviewSiteName).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.authPreviewCameras).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: he.loginTitle })).toBeInTheDocument();
    const skip = screen.getByRole("link", { name: he.skipToForm });
    expect(skip).toHaveAttribute("href", "#auth-form");
    expect(skip.className).toContain("sr-only");
    expect(screen.queryByText("סביבת עבודה אחת לצוות")).not.toBeInTheDocument();
    expect(screen.queryByText(/99\.9/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ROI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/פיילוט/)).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthLayout } from "../src/components/AuthLayout";
import { LoginForm } from "../src/components/LoginForm";
import { RegisterForm } from "../src/components/RegisterForm";
import { VerifyEmailPanel } from "../src/components/VerifyEmailPanel";
import { he } from "../src/i18n/he";
import { authErrorMessage } from "../src/lib/auth-errors";
import { resetPasswordRedirectUrl, signupVerifyRedirectUrl, hasAuthCallback } from "../src/lib/auth-redirect";
import { afterAuthPath, guestEntryPath } from "../src/lib/auth-routes";
import { scorePassword } from "../src/lib/password-strength";
import { isSpaApiUrl, requireProductionApiUrl } from "../src/lib/public-api-url";
import { authTokenStorage, getRememberDevice, setRememberDevice } from "../src/lib/remember-device";
import { API_UNAVAILABLE_HE, createApiClient, parseApiResponse } from "@site-secure/api-client";

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
  Navigate: ({ to, params }: { to: string; params?: Record<string, string> }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return <span data-testid="navigate">{href}</span>;
  },
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

describe("auth email redirects", () => {
  it("follows the current origin and never hardcodes localhost or a Vercel alias", () => {
    const production = "https://site-secure-umber.vercel.app";
    const local = "http://localhost:5173";
    expect(signupVerifyRedirectUrl(production)).toBe(`${production}/login`);
    expect(resetPasswordRedirectUrl(production)).toBe(`${production}/reset-password`);
    expect(signupVerifyRedirectUrl(local)).toBe(`${local}/login`);
    expect(resetPasswordRedirectUrl(local)).toBe(`${local}/reset-password`);
    expect(signupVerifyRedirectUrl(production)).not.toContain("localhost");
    expect(resetPasswordRedirectUrl(production)).not.toContain("localhost");
    expect(signupVerifyRedirectUrl()).toBe(`${window.location.origin}/login`);
    expect(resetPasswordRedirectUrl()).toBe(`${window.location.origin}/reset-password`);
  });

  it("detects the email confirmation callback so Site URL / does not stay on the marketing page", () => {
    expect(hasAuthCallback("?code=abc", "")).toBe(true);
    expect(hasAuthCallback("", "#access_token=tok&type=signup")).toBe(true);
    expect(hasAuthCallback("", "")).toBe(false);
    expect(hasAuthCallback("?utm=1", "#hero")).toBe(false);
  });
});

describe("production API URL", () => {
  it("rejects localhost so Vercel never bakes in :8000", () => {
    expect(() => requireProductionApiUrl(undefined)).toThrow(/VITE_API_URL/);
    expect(requireProductionApiUrl(undefined, true)).toBe("");
    expect(() => requireProductionApiUrl("http://localhost:8000", true)).toThrow(/localhost/);
    expect(() => requireProductionApiUrl("http://127.0.0.1:8000", true)).toThrow(/localhost/);
    expect(requireProductionApiUrl("http://localhost:8000", false)).toBe("http://localhost:8000");
    expect(requireProductionApiUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(isSpaApiUrl("http://localhost:5173")).toBe(true);
    expect(isSpaApiUrl("http://localhost:8000")).toBe(false);
    expect(isSpaApiUrl("https://site-secure-umber.vercel.app", "https://site-secure-umber.vercel.app")).toBe(true);
  });
});

describe("parseApiResponse", () => {
  it("does not crash on empty 405 from a static host", async () => {
    const res = new Response("", { status: 405, statusText: "Method Not Allowed" });
    await expect(parseApiResponse(res)).rejects.toMatchObject({
      status: 405,
      code: "API_UNAVAILABLE",
      message: API_UNAVAILABLE_HE,
    });
  });

  it("does not call a relative /api URL when the API origin is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = createApiClient({ baseUrl: "", getAccessToken: async () => "token" });
    await expect(client.patchMe({ full_name: "Ilya Kerner" })).rejects.toMatchObject({
      status: 503,
      code: "API_UNAVAILABLE",
      message: API_UNAVAILABLE_HE,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("uses a same-origin /api path only when the Vite proxy is enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const client = createApiClient({
      baseUrl: "",
      sameOriginProxy: true,
      getAccessToken: async () => "token",
    });
    await client.patchMe({ full_name: "Ilya Kerner" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({ method: "PATCH" }),
    );
    fetchSpy.mockRestore();
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
    expect(screen.getByRole("checkbox", { name: he.rememberMe })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.loginSecondaryForgot })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("button", { name: he.showPassword })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.loginSecondaryRegister })).not.toBeInTheDocument();
  });

  it("shows authenticating and granted labels without a second primary", () => {
    const { rerender } = render(<LoginForm loading onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: he.authenticating })).toBeDisabled();
    rerender(<LoginForm granted onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: he.accessGranted })).toBeDisabled();
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
    expect(screen.getByText(he.passwordStrength)).toBeInTheDocument();
    expect(screen.getByText(he.passwordRuleLength)).toBeInTheDocument();
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

describe("register identity copy", () => {
  it("creates an account, not a workspace", () => {
    render(
      <AuthLayout
        kicker={he.authCreateAccount}
        title={he.registerTitle}
        heading={he.registerTitle}
        description={he.registerLead}
      >
        <p>form</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: he.registerTitle })).toBeInTheDocument();
    expect(screen.getByText(he.registerLead)).toBeInTheDocument();
    expect(screen.queryByText(he.stepAccount)).not.toBeInTheDocument();
    expect(screen.queryByText(he.stepWorkspace)).not.toBeInTheDocument();
  });
});

describe("VerifyEmailPanel", () => {
  it("names the inbox and offers a real resend, not a fake open-mail button", () => {
    const onResend = vi.fn();
    render(<VerifyEmailPanel email="ilya@example.com" onResend={onResend} />);
    expect(screen.getByText("ilya@example.com")).toBeInTheDocument();
    expect(screen.getByText(he.verifyNext)).toBeInTheDocument();
    expect(screen.getByText(he.openEmail)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.verifyResend })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: he.openEmail })).not.toBeInTheDocument();
  });
});

describe("AuthLayout", () => {
  it("is a dark operations console that belongs to the same product as the public site", () => {
    render(
      <AuthLayout kicker={he.authWelcomeBack} title={he.loginTitle} heading={he.loginLead}>
        <p>form</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("complementary", { name: he.brand })).toBeInTheDocument();
    expect(screen.getAllByText(he.brand).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.authPlatformLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(he.authHeadlineLine1)).toBeInTheDocument();
    expect(screen.getByText(he.authHeadlineLine2)).toBeInTheDocument();
    expect(screen.getByText(he.authHebrewSupport)).toBeInTheDocument();
    expect(screen.getByText(he.authWelcomeBack)).toBeInTheDocument();
    expect(screen.getByLabelText(he.authOpsAria)).toBeInTheDocument();
    expect(screen.getByText(he.authOpsPreviewLabel)).toBeInTheDocument();
    expect(screen.getAllByText(he.authOpsStatusLabel).length).toBeGreaterThan(0);
    expect(screen.getAllByText(he.authOpsStatusValue).length).toBeGreaterThan(0);
    expect(screen.getByText(he.authOpsWorkspaceName)).toBeInTheDocument();
    expect(screen.getAllByText(he.authOpsNetworkLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(he.authOpsSystemsLabel)).toBeInTheDocument();
    expect(screen.getByText(he.authTrustAuth)).toBeInTheDocument();
    expect(screen.getByText(he.authFooterLegal)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "/legal/security");
    expect(screen.getByRole("heading", { name: he.loginLead })).toBeInTheDocument();
    const skip = screen.getByRole("link", { name: he.skipToForm });
    expect(skip).toHaveAttribute("href", "#auth-form");
    expect(skip).toHaveClass("skip-link");
    expect(screen.getAllByRole("link", { name: he.brand }).every((el) => el.getAttribute("href") === "/")).toBe(true);
    expect(screen.queryByText(/99\.9/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ROI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ENCRYPTED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/פיילוט/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /microsoft/i })).not.toBeInTheDocument();
  });
});

describe("password strength", () => {
  it("only treats length as the blocking bar, and scores complexity above that", () => {
    expect(scorePassword("")).toBe(0);
    expect(scorePassword("short")).toBe(0);
    expect(scorePassword("longenough")).toBe(1);
    expect(scorePassword("LongEnough1")).toBe(3);
    expect(scorePassword("LongEnoughPass1")).toBe(4);
  });
});

describe("remember device storage", () => {
  it("keeps existing local sessions readable and writes to session storage when opted out", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    expect(getRememberDevice()).toBe(true);
    window.localStorage.setItem("sb-token", "existing");
    expect(authTokenStorage.getItem("sb-token")).toBe("existing");

    setRememberDevice(false);
    expect(getRememberDevice()).toBe(false);
    authTokenStorage.setItem("sb-token", "fresh");
    expect(window.sessionStorage.getItem("sb-token")).toBe("fresh");
    expect(window.localStorage.getItem("sb-token")).toBeNull();

    setRememberDevice(true);
    authTokenStorage.setItem("sb-token", "kept");
    expect(window.localStorage.getItem("sb-token")).toBe("kept");
    expect(window.sessionStorage.getItem("sb-token")).toBeNull();
  });
});

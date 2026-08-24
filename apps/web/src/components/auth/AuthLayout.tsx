import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { useDocumentMeta } from "../../lib/document-meta";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { AuthExperienceProvider } from "./AuthExperience";
import { AuthHeader } from "./AuthHeader";
import { AuthStepRail, type AuthStepStatus } from "./AuthStepRail";
import { AuthTrust } from "./AuthTrust";
import { LegalNav } from "../public/LegalNav";

export function AuthLayout({
  title,
  kicker,
  heading,
  description,
  steps,
  children,
  footer,
  showTrust = true,
  variant = "default",
}: {
  title: string;
  kicker?: string;
  heading?: string;
  description?: string;
  steps?: readonly { n: string; label: string; status: AuthStepStatus }[];
  children: ReactNode;
  footer?: ReactNode;
  showTrust?: boolean;
  variant?: "default" | "login";
}) {
  useDocumentMeta({
    title: `${title} — ${he.brand}`,
    robots: "noindex, nofollow",
  });
  const currentIndex = steps?.findIndex((step) => step.status === "current") ?? -1;
  const stepOf =
    steps && currentIndex >= 0 ? he.authStepOf(currentIndex + 1, steps.length) : undefined;
  const slideKey = steps?.[currentIndex]?.n ?? "form";
  return (
    <AuthExperienceProvider>
      <div className="auth-root auth-shell flex min-h-dvh flex-col lg:flex-row" dir="ltr">
        <a href="#auth-form" className="skip-link">
          {he.skipToForm}
        </a>
        <AuthBrandPanel />
        <main className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-8 lg:w-[45%] lg:shrink-0 lg:border-s lg:border-border lg:px-12 lg:py-16">
          <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
            <div
              className={
                variant === "login"
                  ? "auth-panel auth-panel-login px-5 py-7 sm:px-8 sm:py-8"
                  : "auth-panel px-5 py-7 sm:px-8 sm:py-8"
              }
              dir="rtl"
            >
              <div className={variant === "login" ? "flex flex-col gap-6" : "flex flex-col gap-7"}>
                <AuthHeader
                  kicker={kicker}
                  stepOf={stepOf}
                  title={heading ?? title}
                  description={description}
                  showBrand={variant === "login"}
                />
                {steps ? <AuthStepRail steps={steps} /> : null}
                <div id="auth-form" tabIndex={-1} className="auth-form-body outline-none">
                  {steps ? (
                    <div key={slideKey} className="auth-form-slide">
                      {children}
                    </div>
                  ) : (
                    children
                  )}
                </div>
                {footer ? <div className="auth-form-footer">{footer}</div> : null}
                {showTrust ? <AuthTrust /> : null}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <LegalNav compact className="justify-center text-[11px] tracking-[0.08em]" />
              <p className="public-mono text-center text-[10px] tracking-[0.12em] text-fg-muted">
                {he.authFooterLegal}
              </p>
            </div>
          </div>
        </main>
      </div>
    </AuthExperienceProvider>
  );
}

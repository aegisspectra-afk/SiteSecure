import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useDocumentMeta } from "../../lib/document-meta";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { AuthHeader } from "./AuthHeader";

export function AuthLayout({
  title,
  kicker,
  heading,
  description,
  steps,
  children,
  footer,
}: {
  title: string;
  kicker?: string;
  heading?: string;
  description?: string;
  steps?: readonly { n: string; label: string }[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  useDocumentMeta({
    title: `${title} — ${he.brand}`,
    robots: "noindex, nofollow",
  });
  return (
    <div className="public-root public-shell flex min-h-dvh flex-col lg:flex-row" dir="ltr">
      <a href="#auth-form" className="skip-link">
        {he.skipToForm}
      </a>
      <AuthBrandPanel />
      <main className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-8 lg:w-[42%] lg:shrink-0 lg:border-s lg:border-border lg:px-12 lg:py-16">
        <Link
          to="/"
          className="ltr-meta mb-10 w-fit text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
        >
          {he.brand}
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-8" dir="rtl">
          <AuthHeader kicker={kicker} title={heading ?? title} description={description} />
          {steps ? (
            <ol className="flex flex-wrap gap-x-6 gap-y-2" dir="ltr">
              {steps.map((step) => (
                <li key={step.n} className="public-mono text-[11px] tracking-[0.12em] text-fg-muted">
                  <span className="text-fg">{step.n}</span> {step.label}
                </li>
              ))}
            </ol>
          ) : null}
          <div id="auth-form" tabIndex={-1} className="outline-none">
            {children}
          </div>
          {footer ? <div className="border-t border-border pt-6">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

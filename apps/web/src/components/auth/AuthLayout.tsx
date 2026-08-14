import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { AuthHeader } from "./AuthHeader";
import { AuthSiteFilePreview } from "./AuthSiteFilePreview";

export function AuthLayout({
  title,
  welcome,
  description,
  children,
  footer,
}: {
  title: string;
  welcome?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-0 lg:flex-row">
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-bg-1 focus:px-3 focus:py-2 focus:text-sm focus:text-fg"
      >
        {he.skipToForm}
      </a>
      <AuthBrandPanel />
      <main className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-8 lg:rounded-[var(--radius-panel)] lg:border lg:border-border lg:bg-bg-1 lg:p-8 lg:shadow-card">
          <AuthHeader title={title} welcome={welcome} description={description} />
          <div id="auth-form" tabIndex={-1} className="outline-none">
            {children}
          </div>
          {footer ? <div className="border-t border-border pt-6">{footer}</div> : null}
        </div>
        <div className="mx-auto mt-8 w-full max-w-[400px] lg:hidden">
          <AuthSiteFilePreview compact />
        </div>
      </main>
    </div>
  );
}

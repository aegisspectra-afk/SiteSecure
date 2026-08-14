import { he } from "../../i18n/he";
import { AuthSiteFilePreview } from "./AuthSiteFilePreview";

export function AuthBrandPanel() {
  return (
    <aside
      aria-label={he.brand}
      className="auth-brand-grid text-auth-panel-fg border-action border-b-4 lg:w-[46%] lg:min-h-dvh lg:border-b-0 lg:border-e-4"
    >
      <div className="flex flex-col px-4 py-5 sm:px-6 lg:h-full lg:justify-between lg:px-12 lg:py-16">
        <div className="flex flex-col gap-2 lg:hidden">
          <p className="ltr-meta text-sm font-semibold tracking-[0.18em] text-auth-panel-fg">{he.brand}</p>
          <p className="text-xs leading-relaxed text-auth-panel-muted">
            {he.productLineRole} {he.productLineAudience}
          </p>
        </div>
        <div className="hidden flex-col gap-6 lg:flex">
          <p className="ltr-meta text-sm font-semibold tracking-[0.18em] text-auth-panel-fg">{he.brand}</p>
          <p className="max-w-sm text-lg font-semibold leading-snug text-auth-panel-fg">
            <span className="block">{he.productLineRole}</span>
            <span className="mt-1 block font-normal text-auth-panel-muted">{he.productLineAudience}</span>
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-auth-panel-muted">{he.authTagline}</p>
        </div>
        <div className="hidden lg:block">
          <AuthSiteFilePreview />
        </div>
      </div>
    </aside>
  );
}

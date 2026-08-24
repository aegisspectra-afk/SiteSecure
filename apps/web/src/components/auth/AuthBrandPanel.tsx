import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { AuthProductFlow } from "./AuthProductFlow";

export function AuthBrandPanel() {
  return (
    <aside
      aria-label={he.brand}
      className="relative hidden min-h-dvh w-[55%] flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-16 xl:py-12"
    >
      <div className="auth-brand-atmosphere" aria-hidden />

      <div className="relative flex max-w-lg flex-col gap-10">
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            className="ltr-meta w-fit text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.brand}
          </Link>
          <p className="public-mono text-[11px] tracking-[0.16em] text-fg-muted">{he.authPlatformLabel}</p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="ltr-meta text-3xl font-semibold leading-[0.95] tracking-[-0.04em] text-fg xl:text-4xl">
            <span className="block">{he.authHeadlineLine1}</span>
            <span className="mt-2 block text-fg-muted">{he.authHeadlineLine2}</span>
          </p>
        </div>

        <AuthProductFlow />
      </div>

      <p className="relative public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authAttribution}</p>
    </aside>
  );
}

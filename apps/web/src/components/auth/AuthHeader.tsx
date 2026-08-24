import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

export function AuthHeader({
  kicker,
  stepOf,
  title,
  description,
  showBrand = false,
}: {
  kicker?: string;
  stepOf?: string;
  title: string;
  description?: string;
  showBrand?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {showBrand ? (
        <div className="flex flex-col gap-1">
          <p className="ltr-meta text-[11px] font-semibold tracking-[0.22em] text-fg">{he.brand}</p>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authPlatformLabel}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 lg:hidden">
          <Link
            to="/"
            className="ltr-meta w-fit text-[11px] font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.brand}
          </Link>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authPlatformLabel}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {kicker ? (
          <p
            className={
              showBrand
                ? "public-mono text-[10px] tracking-[0.18em] text-fg-muted"
                : "text-xs font-medium text-fg-muted"
            }
          >
            {kicker}
          </p>
        ) : null}
        {stepOf ? <p className="text-xs font-medium text-fg-muted">{stepOf}</p> : null}
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-fg">{title}</h1>
        {description ? <p className="text-sm leading-6 text-fg-muted">{description}</p> : null}
      </div>
    </div>
  );
}

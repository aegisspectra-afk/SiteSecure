import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

export function AuthHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          to="/"
          className="ltr-meta w-fit text-[11px] font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.brand}
        </Link>
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authPlatformLabel}</p>
      </div>
      <div className="flex flex-col gap-3">
        {kicker ? (
          <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{kicker}</p>
        ) : null}
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-fg">{title}</h1>
        {description ? <p className="text-sm leading-6 text-fg-muted">{description}</p> : null}
      </div>
    </div>
  );
}

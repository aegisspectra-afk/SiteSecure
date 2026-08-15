import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { AuthOpsBoard } from "./AuthOpsBoard";

export function AuthBrandPanel() {
  return (
    <aside
      aria-label={he.brand}
      className="relative hidden min-h-dvh w-[55%] flex-col justify-between overflow-y-auto px-10 py-10 lg:flex xl:px-16 xl:py-12"
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]"
        aria-hidden
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="rgb(11 107 203 / 35%)" strokeWidth="1">
          <line className="auth-flow" x1="80" y1="120" x2="260" y2="210" />
          <line className="auth-flow" x1="260" y1="210" x2="480" y2="160" />
          <line className="auth-flow" x1="260" y1="210" x2="300" y2="420" />
          <line className="auth-flow" x1="480" y1="160" x2="680" y2="280" />
          <line className="auth-flow" x1="300" y1="420" x2="520" y2="510" />
          <line className="auth-flow" x1="520" y1="510" x2="700" y2="640" />
        </g>
        {[
          [80, 120],
          [260, 210],
          [480, 160],
          [300, 420],
          [680, 280],
          [520, 510],
          [700, 640],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="auth-node-pulse" cx={x} cy={y} r="2.5" fill="#4d9adc" />
        ))}
      </svg>

      <div className="relative flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            className="ltr-meta w-fit text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.brand}
          </Link>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.authPlatformLabel}</p>
        </div>
        <div className="flex max-w-lg flex-col gap-4">
          <p className="ltr-meta text-3xl font-semibold leading-[0.95] tracking-[-0.04em] text-fg xl:text-4xl">
            <span className="block">{he.authHeadlineLine1}</span>
            <span className="mt-2 block text-fg-muted">{he.authHeadlineLine2}</span>
          </p>
          <p dir="rtl" className="max-w-md text-base leading-7 text-fg">
            {he.authHebrewSupport}
          </p>
        </div>
        <div className="max-w-md">
          <AuthOpsBoard />
        </div>
      </div>
      <p className="relative public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.authAttribution}</p>
    </aside>
  );
}

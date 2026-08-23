import { Tooltip } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

export type RingTone = "action" | "success" | "warning" | "danger" | "info" | "neutral" | "tech" | "analytics";
export type RingSize = "primary" | "secondary";
export type RingHref = "/app/quotes" | "/app/quotes/new" | "/app/settings/users";

const SIZE: Record<RingSize, number> = { primary: 136, secondary: 104 };
const STROKE: Record<RingSize, number> = { primary: 10, secondary: 8 };

export function RingMetric({
  percent,
  label,
  hint,
  next,
  action,
  href,
  tip,
  tone = "action",
  size = "secondary",
  onActivate,
  expanded,
  controlsId,
}: {
  percent: number | null;
  label: string;
  hint: string;
  next?: string;
  action?: string;
  href?: RingHref;
  tip?: string;
  tone?: RingTone;
  size?: RingSize;
  onActivate?: () => void;
  expanded?: boolean;
  controlsId?: string;
}) {
  const dim = SIZE[size];
  const stroke = STROKE[size];
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const center = percent == null ? "—" : he.uxPercent(clamped);
  const aria =
    percent == null ? `${label}: ${he.uxMetricEmpty}` : `${label}: ${clamped} אחוז. ${hint}`;

  const title = onActivate ? (
    <span className="text-sm font-medium text-fg">{label}</span>
  ) : tip ? (
    <Tooltip content={tip}>
      <h3 className="text-sm font-medium text-fg">{label}</h3>
    </Tooltip>
  ) : (
    <h3 className="text-sm font-medium text-fg">{label}</h3>
  );

  const body = (
    <>
      <div className={`ops-ring ops-ring--${size}`} role="img" aria-label={aria}>
        <svg viewBox={`0 0 ${dim} ${dim}`} width={dim} height={dim} aria-hidden>
          <circle className="ops-ring-track" cx={dim / 2} cy={dim / 2} r={radius} strokeWidth={stroke} />
          {percent != null && clamped > 0 ? (
            <circle
              className={`ops-ring-value ops-ring-value--${tone}`}
              cx={dim / 2}
              cy={dim / 2}
              r={radius}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          ) : null}
        </svg>
        <span className="ops-ring-center" dir="ltr">
          {center}
        </span>
      </div>
      {title}
      <span className="text-xs text-fg-muted">{hint}</span>
      {next ? <span className="text-xs font-medium text-fg">{next}</span> : null}
      {action ? <span className="text-sm font-medium text-action">{action}</span> : null}
    </>
  );

  const className = `ops-ring-metric${size === "primary" ? " is-primary" : ""}`;
  if (onActivate) {
    return (
      <button
        type="button"
        className={className}
        onClick={onActivate}
        aria-expanded={expanded}
        aria-controls={controlsId}
      >
        {body}
      </button>
    );
  }
  if (!href) {
    return <article className={className}>{body}</article>;
  }
  return (
    <Link
      to={href}
      className={`${className} rounded-[var(--radius-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
    >
      {body}
    </Link>
  );
}

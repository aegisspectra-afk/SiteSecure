import type { BusinessChart, DashboardSummary } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";

/**
 * A sparkline needs a real series. One positive bucket on a zero baseline
 * draws a flat stroke and a cliff — hide that instead of inventing points.
 */
export function meaningfulSparkline(values: number[]): number[] | null {
  const clean = values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  if (clean.length < 2) return null;
  const positive = clean.filter((v) => v > 0).length;
  if (positive < 2) return null;
  return clean;
}

function MiniSparkline({ values }: { values: number[] }) {
  const clean = meaningfulSparkline(values);
  if (!clean) return null;

  const width = 120;
  const height = 36;
  const padY = 3;
  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const span = Math.max(max - min, 1);
  const step = width / (clean.length - 1);
  const points = clean
    .map((value, index) => {
      const x = index * step;
      const y = height - padY - ((value - min) / span) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = clean[clean.length - 1] ?? 0;
  const first = clean[0] ?? 0;
  const rising = last >= first;

  return (
    <svg
      className="ops-command-balance-spark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={rising ? "var(--color-action)" : "var(--color-fg-muted)"}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

/**
 * Fintech-style pipeline balance for the command header left rail.
 * Uses only DashboardSummary + BusinessChart — no invented metrics.
 */
export function DashboardCommandBalance({
  summary,
  chart = null,
}: {
  summary: DashboardSummary;
  chart?: BusinessChart | null;
}) {
  const openValue = summary.quotes_open_value ?? 0;
  const openCount = summary.quotes_open ?? 0;
  const approvedValue = summary.quotes_approved_value ?? 0;
  const sparkValues = chart?.revenue?.length ? chart.revenue : null;

  return (
    <Link
      to="/app/analytics"
      className="ops-command-balance"
      aria-label={`${he.snapshotOpenValue}: ${formatMoney(openValue)}`}
    >
      <div className="ops-command-balance-main">
        <p className="ops-command-balance-kicker">{he.snapshotOpenValue}</p>
        <p className="ops-command-balance-value tabular-nums ltr-meta" dir="ltr">
          {formatMoney(openValue)}
        </p>
        <p className="ops-command-balance-meta">
          <span>{he.dashBalanceOpenCount(openCount)}</span>
          <span className="ops-command-balance-meta-sep" aria-hidden>
            ·
          </span>
          <span>
            {he.snapshotApprovedValue} {formatMoney(approvedValue)}
          </span>
        </p>
      </div>
      {sparkValues ? <MiniSparkline values={sparkValues} /> : null}
    </Link>
  );
}

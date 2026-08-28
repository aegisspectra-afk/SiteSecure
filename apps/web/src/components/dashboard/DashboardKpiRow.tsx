import { he } from "../../i18n/he";

type KpiCard = {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
};

export function DashboardKpiRow({
  quotesOpen,
  jobsOverdue,
  attentionCount,
}: {
  quotesOpen: number;
  jobsOverdue: number;
  attentionCount: number;
}) {
  const cards: KpiCard[] = [
    {
      label: he.opsHealthMetricQuotes,
      value: quotesOpen,
      tone: quotesOpen > 0 ? "warning" : "default",
    },
    {
      label: he.opsHealthMetricOverdue,
      value: jobsOverdue,
      tone: jobsOverdue > 0 ? "danger" : "default",
    },
    {
      label: he.opsHealthMetricAttention,
      value: attentionCount,
      tone: attentionCount > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="ops-kpi-row" aria-label={he.dashboardKpiLabel}>
      {cards.map((card) => (
        <div
          key={card.label}
          className={`ops-kpi-card${card.tone === "warning" ? " is-warning" : card.tone === "danger" ? " is-danger" : ""}`}
        >
          <p className="text-xs text-fg-muted">{card.label}</p>
          <p className="public-mono mt-2 text-3xl font-semibold tracking-[-0.03em] text-fg tabular-nums">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

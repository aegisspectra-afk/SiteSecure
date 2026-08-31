import type { DashboardSummary } from "@site-secure/api-client";
import { Clock, FileText, type LucideIcon } from "lucide-react";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";

type KpiCard = {
  label: string;
  value: string | number;
  subText: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon: LucideIcon;
};

export function DashboardKpiRow({
  summary,
  showOpenQuotes = true,
}: {
  summary: DashboardSummary;
  showOpenQuotes?: boolean;
}) {
  const openValue = formatMoney(summary.quotes_open_value ?? 0);
  const cards: KpiCard[] = [];

  if (showOpenQuotes && summary.quotes_open > 0) {
    cards.push({
      label: he.opsHealthMetricQuotes,
      value: summary.quotes_open,
      subText: he.kpiOpenValueSub(openValue),
      tone: "warning",
      icon: FileText,
    });
  }

  if (summary.jobs_overdue > 0) {
    cards.push({
      label: he.opsHealthMetricOverdue,
      value: summary.jobs_overdue,
      subText: he.kpiStatusCritical,
      tone: "danger",
      icon: Clock,
    });
  }

  if (!cards.length) return null;

  return (
    <div className="ops-kpi-row is-compact" aria-label={he.dashboardKpiLabel}>
      {cards.map((card) => {
        const Icon = card.icon;
        const valueTone =
          card.tone === "danger"
            ? "text-danger"
            : card.tone === "warning"
              ? "text-warning"
              : card.tone === "success"
                ? "text-success"
                : "text-fg";

        return (
          <div
            key={card.label}
            className={`ops-kpi-card${card.tone === "warning" ? " is-warning" : card.tone === "danger" ? " is-danger" : card.tone === "success" ? " is-success" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-fg-muted">{card.label}</p>
              <Icon
                className={`size-4 shrink-0 ${card.tone === "danger" ? "text-danger" : card.tone === "warning" ? "text-warning" : card.tone === "success" ? "text-success" : "text-fg-subtle"}`}
                aria-hidden
              />
            </div>
            <p className={`public-mono mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums ${valueTone}`}>
              {card.value}
            </p>
            <p className="mt-1 text-xs text-fg-muted">{card.subText}</p>
          </div>
        );
      })}
    </div>
  );
}

import type { AttentionGroup, DashboardSummary } from "@site-secure/api-client";
import { AlertTriangle, Clock, FileText, TrendingUp, type LucideIcon } from "lucide-react";
import { he } from "../../i18n/he";
import { attentionCount } from "../../lib/next-best-action";
import { attentionUrgentCount } from "../../lib/attention-queue";
import { formatMoney } from "../../lib/quotes";
import { quoteConversion } from "../../lib/ux-metrics";

type KpiCard = {
  label: string;
  value: string | number;
  subText: string;
  tone?: "default" | "success" | "warning" | "danger";
  icon: LucideIcon;
};

export function DashboardKpiRow({
  summary,
  attention = [],
  showQuotes = true,
}: {
  summary: DashboardSummary;
  attention?: AttentionGroup[];
  showQuotes?: boolean;
}) {
  const conversion = quoteConversion(summary);
  const urgent = attentionUrgentCount(attention);
  const attentionTotal = attentionCount(attention);
  const openValue = formatMoney(summary.quotes_open_value ?? 0);

  const cards: KpiCard[] = [
    {
      label: he.opsHealthMetricQuotes,
      value: showQuotes ? summary.quotes_open : 0,
      subText: showQuotes && summary.quotes_open > 0 ? he.kpiOpenValueSub(openValue) : "—",
      tone: summary.quotes_open > 0 ? "warning" : "default",
      icon: FileText,
    },
    {
      label: he.opsHealthMetricOverdue,
      value: summary.jobs_overdue,
      subText: summary.jobs_overdue > 0 ? he.kpiStatusCritical : he.kpiOverdueClear,
      tone: summary.jobs_overdue > 0 ? "danger" : "success",
      icon: Clock,
    },
    {
      label: he.opsHealthMetricAttention,
      value: attentionTotal,
      subText: urgent > 0 ? he.kpiUrgentSub(urgent) : attentionTotal > 0 ? he.kpiStatusAttention : "—",
      tone: urgent > 0 ? "danger" : attentionTotal > 0 ? "warning" : "default",
      icon: AlertTriangle,
    },
    {
      label: he.kpiConversionLabel,
      value: conversion.percent != null && conversion.total >= 1 ? he.uxPercent(conversion.percent) : "—",
      subText:
        conversion.total > 0 ? he.kpiConversionSub(conversion.approved, conversion.total) : he.kpiConversionEmpty,
      tone: conversion.percent != null && conversion.percent >= 30 ? "success" : "default",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="ops-kpi-row is-four" aria-label={he.dashboardKpiLabel}>
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

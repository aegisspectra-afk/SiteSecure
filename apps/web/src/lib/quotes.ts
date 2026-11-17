import type { StatusTone } from "@site-secure/ui";
import { he } from "../i18n/he";

export function quoteStatusLabel(status: string, archivedAt?: string | null): string {
  if (archivedAt) return he.quoteStatuses.archived;
  return he.quoteStatuses[status as keyof typeof he.quoteStatuses] ?? status;
}

export function quoteStatusTone(status: string, archivedAt?: string | null): StatusTone {
  if (archivedAt) return "neutral";
  if (status === "approved") return "success";
  if (status === "sent" || status === "viewed") return "info";
  if (status === "rejected" || status === "expired" || status === "cancelled" || status === "superseded") return "danger";
  return "neutral";
}

export function formatMoney(value: number | null | undefined, currency = "ILS"): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(Number(value) * 100) / 100;
  const whole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(rounded);
}

const dashboardMoneyFmt = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export type DashboardMoneyParts = {
  /** Visible amount (may be abbreviated). */
  text: string;
  /** Full amount — used as tooltip when compact. */
  title: string;
  compact: boolean;
};

/** Whole-shekel ILS for dashboard metric cards; abbreviates above 100,000. */
export function formatDashboardMoney(value: number | null | undefined): DashboardMoneyParts {
  if (value == null || Number.isNaN(value)) {
    return { text: "—", title: "—", compact: false };
  }
  const n = Math.round(Number(value));
  const full = dashboardMoneyFmt.format(n);
  const abs = Math.abs(n);
  if (abs <= 100_000) {
    return { text: full, title: full, compact: false };
  }
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    const num = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return { text: `${sign}₪${num} מיליון`, title: full, compact: true };
  }
  const thousands = Math.round(abs / 1_000);
  return {
    text: `${sign}₪${thousands.toLocaleString("he-IL")} אלף`,
    title: full,
    compact: true,
  };
}

/** Normalize Hebrew gershayim / apostrophe artifacts in workspace display names. */
export function displayWorkspaceName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/''/g, "״").replace(/"/g, "״");
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelativeDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (startToday.getTime() - startThat.getTime()) / 86_400_000;
  if (diff === 0) return he.quotesUpdatedToday;
  if (diff === 1) return he.quotesUpdatedYesterday;
  return formatDay(value);
}

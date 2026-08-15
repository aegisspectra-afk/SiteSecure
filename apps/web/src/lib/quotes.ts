import type { StatusTone } from "@site-secure/ui";
import { he } from "../i18n/he";

export function quoteStatusLabel(status: string): string {
  return he.quoteStatuses[status as keyof typeof he.quoteStatuses] ?? status;
}

export function quoteStatusTone(status: string): StatusTone {
  if (status === "approved") return "success";
  if (status === "sent" || status === "viewed") return "info";
  if (status === "rejected" || status === "expired" || status === "cancelled") return "danger";
  return "neutral";
}

export function formatMoney(value: number | null | undefined, currency = "ILS"): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

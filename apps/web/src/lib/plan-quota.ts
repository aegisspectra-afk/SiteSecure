import { ApiClientError } from "@site-secure/api-client";
import { he } from "../i18n/he";

function usageSuffix(details: Record<string, unknown>): string {
  const current = Number(details.current);
  const limit = Number(details.limit);
  if (!Number.isFinite(current) || !Number.isFinite(limit) || limit <= 0) return "";
  return ` (${current}/${limit})`;
}

/** Machine-readable plan quota errors → contextual Hebrew UX (never invent checkout). */
export function planQuotaMessage(err: unknown): string | null {
  if (!(err instanceof ApiClientError) || err.code !== "PLAN_LIMIT_REACHED") return null;
  const resource = String(err.details?.resource || err.details?.limit_key || "");
  const used = usageSuffix(err.details);
  if (resource === "customers" || resource === "quota_clients") {
    return `${he.clientsAtLimit}${used}. ${he.upgradeToIncreaseClients}`;
  }
  if (resource === "quotes" || resource === "quota_quotes") {
    return `${he.quotesAtLimit}${used}. ${he.upgradeToIncreaseQuotes}`;
  }
  if (resource === "storage" || resource === "storage_gb") {
    return he.storageQuotaReached;
  }
  if (resource === "seats_field") {
    return `${he.seatsFieldAtLimit}${used}. ${he.upgradeToIncreaseSeats}`;
  }
  if (resource === "seats_operator") {
    return `${he.seatsOperatorAtLimit}${used}. ${he.upgradeToIncreaseSeats}`;
  }
  if (resource === "technicians" || resource === "max_technicians") {
    return `${he.techniciansAtLimit}${used}. ${he.upgradeToIncreaseSeats}`;
  }
  if (resource === "members" || resource === "max_members") {
    return `${he.membersAtLimit}${used}. ${he.upgradeToIncreaseSeats}`;
  }
  return err.message || he.planLimitReached;
}

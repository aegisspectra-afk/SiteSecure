import { ApiClientError } from "@site-secure/api-client";
import { he } from "../i18n/he";

/** Machine-readable plan quota errors → contextual Hebrew UX (never invent checkout). */
export function planQuotaMessage(err: unknown): string | null {
  if (!(err instanceof ApiClientError) || err.code !== "PLAN_LIMIT_REACHED") return null;
  const resource = String(err.details?.resource || err.details?.limit_key || "");
  if (resource === "customers" || resource === "quota_clients") {
    return `${he.clientsAtLimit}. ${he.upgradeToIncreaseClients}`;
  }
  if (resource === "quotes" || resource === "quota_quotes") {
    return `${he.quotesAtLimit}. ${he.upgradeToIncreaseQuotes}`;
  }
  if (resource === "storage" || resource === "storage_gb") {
    return he.storageQuotaReached;
  }
  return err.message || he.planLimitReached;
}

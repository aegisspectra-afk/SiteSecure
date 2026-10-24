import {
  sspActivationPending,
  sspSiteHasIssuedCode,
  sspSiteToneClass,
  type SspSiteActivityKind,
} from "./ssp-dashboard-view";

export type SspOfficeWarningId = "no_team" | "no_form";
export type SspOfficeActivation = "pending" | "issued" | "active" | "none";
export type SspOfficeSortKey = "name" | "status" | "members" | "forms" | "kind" | "activation";
export type SspOfficeSortDir = "asc" | "desc";
export type SspOfficesListState = "loading" | "error" | "empty" | "no-results" | "rows";

export type SspOfficeSortable = {
  name: string;
  is_active: boolean;
  members_count?: number | null;
  assigned_forms_count?: number | null;
  kind?: string | null;
  activation_status?: string | null;
};

export type SspOfficeWarningSummary = "none" | "no_team" | "no_form" | "setup";

export function sspOfficeWarnings(office: {
  members_count?: number | null;
  assigned_forms_count?: number | null;
}): SspOfficeWarningId[] {
  const warnings: SspOfficeWarningId[] = [];
  if ((office.members_count ?? 0) <= 0) warnings.push("no_team");
  if ((office.assigned_forms_count ?? 0) <= 0) warnings.push("no_form");
  return warnings;
}

export function sspOfficeWarningSummary(warnings: SspOfficeWarningId[]): SspOfficeWarningSummary {
  if (warnings.includes("no_team") && warnings.includes("no_form")) return "setup";
  if (warnings.includes("no_team")) return "no_team";
  if (warnings.includes("no_form")) return "no_form";
  return "none";
}

export function sspOfficeWarningDetail(
  warnings: SspOfficeWarningId[],
  labels: { noTeam: string; noForm: string },
): string {
  return warnings
    .map((id) => (id === "no_team" ? labels.noTeam : labels.noForm))
    .filter(Boolean)
    .join(" · ");
}

export function sspOfficeActivation(status?: string | null): SspOfficeActivation {
  if (sspActivationPending(status)) return "pending";
  if (status === "device_active") return "active";
  if (sspSiteHasIssuedCode(status)) return "issued";
  return "none";
}

export function sspOfficeActivationTone(kind: SspOfficeActivation): SspSiteActivityKind {
  if (kind === "pending") return "pending";
  return "quiet";
}

export function sspOfficeActivationClass(status?: string | null): string {
  return sspSiteToneClass(sspOfficeActivationTone(sspOfficeActivation(status)));
}

export function sspOfficeFiltersActive(query: string, kind: string, status: string): boolean {
  return Boolean(query.trim() || kind || status);
}

export function sspOfficesListState(input: {
  loading: boolean;
  error: boolean;
  itemCount: number;
  filterActive: boolean;
}): SspOfficesListState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.itemCount > 0) return "rows";
  return input.filterActive ? "no-results" : "empty";
}

export function compareSspOffices(
  a: SspOfficeSortable,
  b: SspOfficeSortable,
  key: SspOfficeSortKey,
  dir: SspOfficeSortDir,
): number {
  const sign = dir === "desc" ? -1 : 1;
  let delta = 0;
  if (key === "name") delta = a.name.localeCompare(b.name, "he");
  else if (key === "status") delta = Number(a.is_active) - Number(b.is_active);
  else if (key === "members") delta = (a.members_count ?? 0) - (b.members_count ?? 0);
  else if (key === "forms") delta = (a.assigned_forms_count ?? 0) - (b.assigned_forms_count ?? 0);
  else if (key === "kind") delta = String(a.kind || "").localeCompare(String(b.kind || ""), "he");
  else delta = sspOfficeActivation(a.activation_status).localeCompare(sspOfficeActivation(b.activation_status));
  return delta * sign;
}

export function sortSspOffices<T extends SspOfficeSortable>(
  rows: T[],
  key: SspOfficeSortKey,
  dir: SspOfficeSortDir,
): T[] {
  return [...rows].sort((a, b) => compareSspOffices(a, b, key, dir));
}

export function nextSspOfficeSort(
  currentKey: SspOfficeSortKey,
  currentDir: SspOfficeSortDir,
  nextKey: SspOfficeSortKey,
): { key: SspOfficeSortKey; dir: SspOfficeSortDir } {
  if (currentKey === nextKey) return { key: nextKey, dir: currentDir === "asc" ? "desc" : "asc" };
  return { key: nextKey, dir: "asc" };
}

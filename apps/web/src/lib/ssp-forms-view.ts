export const SSP_FORMS_FILTER_MIN = 5;
export const SSP_FORM_HAS_DELETE_API = false;

export type SspFormStatus = "draft" | "published" | "archived";
export type SspFormSortKey = "name" | "status" | "version" | "assignments" | "updated";
export type SspFormSortDir = "asc" | "desc";
export type SspFormsListState = "loading" | "error" | "empty" | "no-results" | "rows";
export type SspFormStatusTone = "pending" | "quiet" | "officer";

export type SspFormSortable = {
  title: string;
  status: string;
  latest_published_version?: number | null;
  updated_at?: string;
  activeAssignments?: number;
};

export function sspFormStatusTone(status?: string | null): SspFormStatusTone {
  if (status === "draft") return "pending";
  if (status === "published") return "officer";
  return "quiet";
}

export function sspFormVersionKind(version?: number | null): "unpublished" | "version" {
  return version && version > 0 ? "version" : "unpublished";
}

export function sspFormCanAssign(status?: string | null): boolean {
  return status === "published";
}

export function sspFormUnassigned(status?: string | null, activeAssignments?: number | null): boolean {
  if (status !== "published" || activeAssignments == null) return false;
  return activeAssignments <= 0;
}

export function sspFormCanDelete(input: {
  hasDeleteApi?: boolean;
  assignmentCount?: number;
  submissionCount?: number;
}): boolean {
  if (!(input.hasDeleteApi ?? SSP_FORM_HAS_DELETE_API)) return false;
  return (input.assignmentCount ?? 0) <= 0 && (input.submissionCount ?? 0) <= 0;
}

export function sspFormNeedsEditWarning(status?: string | null): boolean {
  return status === "published";
}

export function sspFormNextVersion(current?: number | null): number {
  return (current && current > 0 ? current : 0) + 1;
}

export function sspFormHasTemplates(): boolean {
  return false;
}

export function sspFormFiltersVisible(totalCount: number, min = SSP_FORMS_FILTER_MIN): boolean {
  return totalCount >= min;
}

export function sspFormFiltersActive(query: string, status: string): boolean {
  return Boolean(query.trim() || status);
}

export function sspFormsListState(input: {
  loading: boolean;
  error: boolean;
  itemCount: number;
  filterActive: boolean;
}): SspFormsListState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.itemCount > 0) return "rows";
  return input.filterActive ? "no-results" : "empty";
}

export function filterSspForms<T extends { title: string; status: string; category?: string | null }>(
  items: T[],
  query: string,
  status: string,
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (status && item.status !== status) return false;
    if (!q) return true;
    return `${item.title} ${item.category || ""}`.toLowerCase().includes(q);
  });
}

export function countSspFormAssignments(
  assignments: Array<{ form_id: string; status: string }>,
  formId: string,
): number {
  return assignments.filter((row) => row.form_id === formId && row.status === "active").length;
}

export function countSspFormSubmissions(
  assignments: Array<{ form_id: string; submission_count?: number | null }>,
  formId: string,
): number {
  return assignments
    .filter((row) => row.form_id === formId)
    .reduce((sum, row) => sum + (row.submission_count ?? 0), 0);
}

export function compareSspForms(a: SspFormSortable, b: SspFormSortable, key: SspFormSortKey, dir: SspFormSortDir): number {
  const sign = dir === "desc" ? -1 : 1;
  let delta = 0;
  if (key === "name") delta = a.title.localeCompare(b.title, "he");
  else if (key === "status") delta = a.status.localeCompare(b.status, "he");
  else if (key === "version") delta = (a.latest_published_version ?? 0) - (b.latest_published_version ?? 0);
  else if (key === "assignments") delta = (a.activeAssignments ?? -1) - (b.activeAssignments ?? -1);
  else delta = String(a.updated_at || "").localeCompare(String(b.updated_at || ""));
  return delta * sign;
}

export function sortSspForms<T extends SspFormSortable>(rows: T[], key: SspFormSortKey, dir: SspFormSortDir): T[] {
  return [...rows].sort((a, b) => compareSspForms(a, b, key, dir));
}

export function nextSspFormSort(
  currentKey: SspFormSortKey,
  currentDir: SspFormSortDir,
  nextKey: SspFormSortKey,
): { key: SspFormSortKey; dir: SspFormSortDir } {
  if (currentKey === nextKey) return { key: nextKey, dir: currentDir === "asc" ? "desc" : "asc" };
  return { key: nextKey, dir: "asc" };
}

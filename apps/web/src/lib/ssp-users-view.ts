import type { SspProductRole } from "./ssp-product-authz";

export type SspUserOfficeTag = "org" | "unassigned" | "named";
export type SspUserSortKey = "name" | "role" | "office" | "status";
export type SspUserSortDir = "asc" | "desc";
export type SspUsersListState = "loading" | "error" | "empty" | "no-results" | "rows";
export type SspUserRoleTone = "admin" | "manager" | "officer" | "quiet";

export type SspUserSortable = {
  full_name?: string | null;
  email?: string | null;
  product_role?: string | null;
  status: string;
  officeName?: string;
};

export function sspUserOfficeTag(input: {
  role?: string | null;
  siteCount: number;
}): SspUserOfficeTag {
  if (input.siteCount > 0) return "named";
  if (input.role === "org_admin") return "org";
  return "unassigned";
}

export function sspUserRoleTone(role?: string | null): SspUserRoleTone {
  if (role === "org_admin") return "admin";
  if (role === "patrol_manager") return "manager";
  if (role === "patrol_officer") return "officer";
  return "quiet";
}

export function sspCanDisablePerson(actorUserId: string | null | undefined, targetUserId: string): boolean {
  return Boolean(actorUserId) && actorUserId !== targetUserId;
}

export function sspCanChangePersonRole(input: {
  actorUserId?: string | null;
  targetUserId: string;
  currentRole?: string | null;
  nextRole?: string | null;
}): boolean {
  if (!input.actorUserId || input.actorUserId !== input.targetUserId) return true;
  const current = input.currentRole || "";
  const next = input.nextRole || current;
  if (current === "org_admin" && next !== "org_admin") return false;
  return true;
}

export function sspUserFiltersActive(query: string, office: string, role: string, status: string): boolean {
  return Boolean(query.trim() || office || role || status);
}

export function sspUsersListState(input: {
  loading: boolean;
  error: boolean;
  itemCount: number;
  filterActive: boolean;
}): SspUsersListState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.itemCount > 0) return "rows";
  return input.filterActive ? "no-results" : "empty";
}

export function sspUserDisplayName(person: { full_name?: string | null; email?: string | null; user_id: string }): string {
  return person.full_name?.trim() || person.email || person.user_id.slice(0, 8);
}

export function compareSspUsers(a: SspUserSortable, b: SspUserSortable, key: SspUserSortKey, dir: SspUserSortDir): number {
  const sign = dir === "desc" ? -1 : 1;
  let delta = 0;
  if (key === "name") {
    delta = sspUserDisplayName({
      full_name: a.full_name,
      email: a.email,
      user_id: "",
    }).localeCompare(sspUserDisplayName({ full_name: b.full_name, email: b.email, user_id: "" }), "he");
  } else if (key === "role") {
    delta = String(a.product_role || "").localeCompare(String(b.product_role || ""), "he");
  } else if (key === "office") {
    delta = String(a.officeName || "").localeCompare(String(b.officeName || ""), "he");
  } else {
    delta = String(a.status || "").localeCompare(String(b.status || ""), "he");
  }
  return delta * sign;
}

export function sortSspUsers<T extends SspUserSortable>(rows: T[], key: SspUserSortKey, dir: SspUserSortDir): T[] {
  return [...rows].sort((a, b) => compareSspUsers(a, b, key, dir));
}

export function nextSspUserSort(
  currentKey: SspUserSortKey,
  currentDir: SspUserSortDir,
  nextKey: SspUserSortKey,
): { key: SspUserSortKey; dir: SspUserSortDir } {
  if (currentKey === nextKey) return { key: nextKey, dir: currentDir === "asc" ? "desc" : "asc" };
  return { key: nextKey, dir: "asc" };
}

export function sspUserHasLastLogin(person: { last_login_at?: string | null }): boolean {
  return Boolean(person.last_login_at);
}

export type { SspProductRole };

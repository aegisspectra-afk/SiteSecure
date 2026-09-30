import { cn } from "@site-secure/ui";
import type { ReactNode } from "react";

export type AdminTabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function AdminTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: AdminTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="admin-lifecycle-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`admin-tab-${tab.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn("admin-lifecycle-tab", selected && "is-active")}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="admin-lifecycle-tab-count ltr-meta">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminTabPanel({
  tabId,
  active,
  children,
}: {
  tabId: string;
  active: boolean;
  children: ReactNode;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`admin-panel-${tabId}`}
      aria-labelledby={`admin-tab-${tabId}`}
      className="admin-lifecycle-panel"
    >
      {children}
    </div>
  );
}

export function AdminSummaryStrip({
  items,
}: {
  items: Array<{ label: string; value: number | string; hint?: string }>;
}) {
  return (
    <div className="admin-lifecycle-summary" aria-label="סיכום">
      {items.map((item) => (
        <div key={item.label} className="admin-lifecycle-summary-item">
          <p className="admin-lifecycle-summary-value ltr-meta">{item.value}</p>
          <p className="admin-lifecycle-summary-label">{item.label}</p>
          {item.hint ? <p className="admin-lifecycle-summary-hint">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function userInitials(fullName: string | null | undefined, email: string | null | undefined) {
  const name = (fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return `${a}${b}`.toUpperCase() || "?";
  }
  const e = (email || "").trim();
  return (e[0] || "?").toUpperCase();
}

const ROLE_RANK: Record<string, number> = {
  owner: 0,
  administrator: 1,
  manager: 2,
  sales: 3,
  technician: 4,
  viewer: 5,
};

export function primaryRole(
  memberships: Array<{ role_key: string; status?: string | null }>,
): string | null {
  const active = memberships.filter((m) => !m.status || m.status === "active");
  const pool = active.length ? active : memberships;
  if (!pool.length) return null;
  return [...pool].sort(
    (a, b) => (ROLE_RANK[a.role_key] ?? 99) - (ROLE_RANK[b.role_key] ?? 99),
  )[0]?.role_key ?? null;
}

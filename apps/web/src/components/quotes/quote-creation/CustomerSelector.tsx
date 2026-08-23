import { Building2, ChevronLeft, MapPin, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { he } from "../../../i18n/he";
import { addressLine } from "../../modules/ModuleKit";
import { useSession } from "../../../lib/session";

type CustomerRow = {
  id: string;
  display_name: string;
  type?: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: Record<string, unknown>;
};

export function CustomerSelector({
  onPick,
  onBack,
  onCreateNew,
}: {
  onPick: (customer: {
    id: string;
    name: string;
    sites: { id: string; name?: string; address?: Record<string, unknown>; status?: string }[];
  }) => void;
  onBack: () => void;
  onCreateNew?: () => void;
}) {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [q]);

  const customersQuery = useQuery({
    queryKey: ["quote-flow-customers", workspaceId, debounced],
    enabled: Boolean(workspaceId) && debounced.length >= 1,
    queryFn: () => api.listCustomers(workspaceId!, { q: debounced, limit: 20 }),
  });

  const items = customersQuery.data?.items ?? [];

  const metaQuery = useQuery({
    queryKey: ["quote-flow-customer-meta", workspaceId, items.map((row) => row.id).join(",")],
    enabled: Boolean(workspaceId) && items.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        items.map(async (row) => {
          const sites = await api.listSites(workspaceId!, { customer_id: row.id, limit: 100 });
          return [row.id, sites.items?.length ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    staleTime: 30_000,
  });

  async function select(row: CustomerRow) {
    if (!workspaceId || busyId) return;
    setBusyId(row.id);
    try {
      const sites = await api.listSites(workspaceId, { customer_id: row.id, limit: 100 });
      onPick({
        id: row.id,
        name: row.display_name,
        sites: (sites.items ?? []).map((site) => ({
          id: site.id,
          name: site.name,
          address: site.address,
          status: site.installation_status,
        })),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="quote-flow-customer-q">
        {he.workflowSearchCustomer}
      </label>
      <input
        id="quote-flow-customer-q"
        data-autofocus
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        placeholder={he.workflowSearchCustomer}
        autoComplete="off"
        className="quote-flow-search"
      />

      <ul className="quote-flow-list">
        {customersQuery.isLoading
          ? [0, 1, 2].map((i) => (
              <li key={i} className="quote-flow-skeleton" aria-hidden>
                <span className="quote-flow-skeleton-icon" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="quote-flow-skeleton-line w-2/3" />
                  <span className="quote-flow-skeleton-line w-1/2" />
                </span>
              </li>
            ))
          : null}

        {items.map((row) => {
          const siteCount = metaQuery.data?.[row.id];
          const place = addressLine(row.billing_address);
          const kind =
            row.type === "person" || row.type === "individual"
              ? he.workflowCustomerPrivate
              : he.workflowCustomerBusiness;
          const contact = row.phone || row.email;
          const meta = [kind, siteCount != null ? he.workflowSitesCount(siteCount) : null, place || null]
            .filter(Boolean)
            .join(" · ");
          const Icon = row.type === "person" || row.type === "individual" ? User : Building2;

          return (
            <li key={row.id}>
              <button
                type="button"
                className={`quote-flow-action${busyId === row.id ? " is-busy" : ""}`}
                disabled={Boolean(busyId)}
                onClick={() => void select(row)}
              >
                <span className="quote-flow-action-icon" aria-hidden>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-sm font-semibold text-fg">{row.display_name}</span>
                  <span className="mt-0.5 block truncate text-xs text-fg-muted">
                    {meta || he.loading}
                    {contact ? (
                      <>
                        {" · "}
                        <span className="ltr-meta">{contact}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <ChevronLeft className="quote-flow-action-chevron size-4 shrink-0" aria-hidden />
              </button>
            </li>
          );
        })}

        {debounced && !customersQuery.isLoading && items.length === 0 ? (
          <li className="quote-flow-empty">
            <p className="text-sm font-medium text-fg">{he.workflowNoCustomersFound}</p>
            <p className="mt-1 text-xs text-fg-muted">{he.workflowNoCustomersFoundHint}</p>
            {onCreateNew ? (
              <button type="button" className="quote-flow-empty-cta mt-4" onClick={onCreateNew}>
                {he.workflowNewCustomer}
              </button>
            ) : null}
          </li>
        ) : null}

        {!debounced && !customersQuery.isLoading ? (
          <li className="px-1 py-6 text-center text-sm text-fg-muted">{he.workflowSearchCustomerHint}</li>
        ) : null}
      </ul>

      <button type="button" className="quote-flow-back" onClick={onBack}>
        {he.workflowBack}
      </button>
    </div>
  );
}

export function SiteSelector({
  customerName,
  sites,
  onPick,
  onBack,
}: {
  customerName: string;
  sites: { id: string; name?: string; address?: Record<string, unknown>; status?: string }[];
  onPick: (siteId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="quote-flow-list">
        {sites.map((site) => (
          <li key={site.id}>
            <button type="button" className="quote-flow-action" onClick={() => onPick(site.id)}>
              <span className="quote-flow-action-icon" aria-hidden>
                <MapPin className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-sm font-semibold text-fg">{site.name || site.id}</span>
                <span className="mt-0.5 block truncate text-xs text-fg-muted">
                  {[addressLine(site.address) || he.workflowSiteNoAddress, site.status].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronLeft className="quote-flow-action-chevron size-4 shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="sr-only">{he.workflowPickSiteFor(customerName)}</p>
      <button type="button" className="quote-flow-back" onClick={onBack}>
        {he.workflowBack}
      </button>
    </div>
  );
}

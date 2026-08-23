import type { CustomerOut, SiteOut } from "@site-secure/api-client";
import { Button, Input, Status } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { he } from "../../i18n/he";
import {
  activeFilterCount,
  customerInitials,
  customerStatusLabel,
  customerStatusTone,
  customerTypeLabel,
  filterDirectoryByQuery,
  filterDirectoryRows,
  formatCustomerMeta,
  summarizeDirectory,
  type CustomerDirectoryFilter,
  type CustomerDirectoryRow,
  type CustomerDirectorySummary,
} from "../../lib/customer-directory";

function useDebounced<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function CustomerDirectoryHeader({
  canCreate,
  creating,
  onToggleCreate,
  action,
}: {
  canCreate: boolean;
  creating: boolean;
  onToggleCreate: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="customer-dir-header">
      <div className="min-w-0">
        <h1 className="customer-dir-title">{he.customersTitle}</h1>
        <p className="customer-dir-lead">{he.customersLead}</p>
      </div>
      <div className="customer-dir-header-actions">
        {action}
        {canCreate ? (
          <Button type="button" variant={creating ? "secondary" : "primary"} onClick={onToggleCreate}>
            {creating ? (
              he.cancel
            ) : (
              <>
                <Plus aria-hidden />
                {he.customersCreate}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

export function CustomerDirectoryMetrics({ summary }: { summary: CustomerDirectorySummary }) {
  const cards = [
    { id: "total", label: he.customersTitle, value: summary.total },
    { id: "active", label: he.customerDirectoryActive, value: summary.active },
    { id: "sites", label: he.navSiteFiles, value: summary.sites },
    { id: "leads", label: he.customerDirectoryLeadAttention, value: summary.leadsNeedingAttention },
  ];
  return (
    <div className="customer-dir-metrics" role="group" aria-label={he.customerDirectoryMetrics}>
      {cards.map((card) => (
        <div key={card.id} className="customer-dir-metric">
          <p className="customer-dir-metric-label">{card.label}</p>
          <p className="customer-dir-metric-value tabular-nums">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CustomerDirectorySearch({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="customer-dir-search">
      <Search className="customer-dir-search-icon" aria-hidden />
      <input
        id="customer-directory-search"
        className="customer-dir-search-input"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={he.customerDirectorySearchPlaceholder}
        aria-label={he.customerDirectorySearchPlaceholder}
        autoComplete="off"
      />
      {value ? (
        <button type="button" className="customer-dir-search-clear" onClick={onClear} aria-label={he.customerDirectoryClearSearch}>
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function CustomerDirectoryFilters({
  filter,
  onChange,
}: {
  filter: CustomerDirectoryFilter;
  onChange: (next: CustomerDirectoryFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filter);

  return (
    <div className="customer-dir-filters">
      <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {he.customerDirectoryFilter}
        {count > 0 ? <span className="customer-dir-filter-badge">{count}</span> : null}
      </Button>
      {open ? (
        <div className="customer-dir-filter-panel">
          <label className="customer-dir-filter-row">
            <span>{he.status}</span>
            <select
              value={filter.status ?? ""}
              onChange={(ev) => onChange({ ...filter, status: ev.target.value || undefined })}
            >
              <option value="">{he.all}</option>
              <option value="active">{he.customer360StatusActive}</option>
              <option value="archived">{he.customer360StatusArchived}</option>
              <option value="inactive">{he.customer360StatusInactive}</option>
            </select>
          </label>
          <label className="customer-dir-filter-row">
            <span>{he.customer360CustomerType}</span>
            <select value={filter.type ?? ""} onChange={(ev) => onChange({ ...filter, type: ev.target.value || undefined })}>
              <option value="">{he.all}</option>
              <option value="private">{he.customer360TypePrivate}</option>
              <option value="business">{he.customer360TypeBusiness}</option>
            </select>
          </label>
          <label className="customer-dir-check">
            <input
              type="checkbox"
              checked={Boolean(filter.hasSites)}
              onChange={(ev) => onChange({ ...filter, hasSites: ev.target.checked || undefined })}
            />
            {he.customerDirectoryFilterHasSites}
          </label>
          <label className="customer-dir-check">
            <input
              type="checkbox"
              checked={Boolean(filter.hasOpenQuotes)}
              onChange={(ev) => onChange({ ...filter, hasOpenQuotes: ev.target.checked || undefined })}
            />
            {he.customerDirectoryFilterHasQuotes}
          </label>
          <label className="customer-dir-check">
            <input
              type="checkbox"
              checked={Boolean(filter.hasProjects)}
              onChange={(ev) => onChange({ ...filter, hasProjects: ev.target.checked || undefined })}
            />
            {he.customerDirectoryFilterHasProjects}
          </label>
          <label className="customer-dir-check">
            <input
              type="checkbox"
              checked={Boolean(filter.hasService)}
              onChange={(ev) => onChange({ ...filter, hasService: ev.target.checked || undefined })}
            />
            {he.customerDirectoryFilterHasService}
          </label>
          <label className="customer-dir-check">
            <input
              type="checkbox"
              checked={Boolean(filter.hasLeadAttention)}
              onChange={(ev) => onChange({ ...filter, hasLeadAttention: ev.target.checked || undefined })}
            />
            {he.customerDirectoryFilterHasLeadAttention}
          </label>
          {count > 0 ? (
            <Button type="button" variant="ghost" onClick={() => onChange({})}>
              {he.customerDirectoryClearFilters}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerAvatar({ name }: { name: string }) {
  return (
    <span className="customer-dir-avatar" aria-hidden>
      {customerInitials(name)}
    </span>
  );
}

export function CustomerRow({ customer }: { customer: CustomerDirectoryRow }) {
  return (
    <Link to="/app/customers/$customerId" params={{ customerId: customer.id }} className="customer-dir-row">
      <CustomerAvatar name={customer.display_name} />
      <div className="customer-dir-row-main">
        <div className="customer-dir-row-top">
          <p className="customer-dir-row-name">{customer.display_name}</p>
          <Status label={customerStatusLabel(customer.status)} tone={customerStatusTone(customer.status)} />
        </div>
        <p className="customer-dir-row-type">{customerTypeLabel(customer.type)}</p>
        <div className="customer-dir-row-contact">
          {customer.phone ? (
            <span dir="ltr">{customer.phone}</span>
          ) : null}
          {customer.email ? (
            <span dir="ltr">{customer.email}</span>
          ) : null}
        </div>
        <p className="customer-dir-row-meta">{formatCustomerMeta(customer.counts)}</p>
        {customer.counts.leadsNeedingAttention > 0 ? (
          <p className="customer-dir-row-lead">
            {he.customerDirectoryLeadNeedsAttention(customer.counts.leadsNeedingAttention)}
          </p>
        ) : null}
      </div>
      <ChevronLeft className="customer-dir-row-chevron" aria-hidden />
    </Link>
  );
}

export function CustomerDirectorySkeleton() {
  return (
    <div className="customer-dir-list" aria-busy="true" aria-label={he.loading}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="customer-dir-skeleton-row">
          <span className="customer-dir-skeleton-avatar" />
          <div className="customer-dir-skeleton-lines">
            <span className="customer-dir-skeleton-line is-lg" />
            <span className="customer-dir-skeleton-line is-md" />
            <span className="customer-dir-skeleton-line is-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomerDirectoryEmpty({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="customer-dir-empty">
      <p className="customer-dir-empty-title">{he.customerDirectoryEmptyTitle}</p>
      <p className="customer-dir-empty-body">{he.customerDirectoryEmptyBody}</p>
      {canCreate ? (
        <Button type="button" className="mt-4" onClick={onCreate}>
          <Plus aria-hidden />
          {he.customersCreate}
        </Button>
      ) : null}
    </div>
  );
}

export function CustomerDirectorySearchEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="customer-dir-empty">
      <p className="customer-dir-empty-title">{he.customerDirectorySearchEmptyTitle}</p>
      <p className="customer-dir-empty-body">{he.customerDirectorySearchEmptyBody}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onClear}>
        {he.customerDirectoryClearSearch}
      </Button>
    </div>
  );
}

export function CustomerCreateForm({
  open,
  pending,
  error,
  name,
  email,
  phone,
  onName,
  onEmail,
  onPhone,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  name: string;
  email: string;
  phone: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onSubmit: (ev: FormEvent) => void;
}) {
  if (!open) return null;
  return (
    <form className="customer-dir-create ops-card p-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input id="customer-name" label={he.name} value={name} onChange={(ev) => onName(ev.target.value)} required data-autofocus />
        <Input id="customer-email" label={he.email} value={email} onChange={(ev) => onEmail(ev.target.value)} />
        <Input id="customer-phone" label={he.phone} value={phone} onChange={(ev) => onPhone(ev.target.value)} />
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button type="submit" loading={pending} disabled={!name.trim() || pending}>
          {he.save}
        </Button>
      </div>
    </form>
  );
}

export function CustomerDirectoryList({
  rows,
  loading,
  query,
  filter,
  canCreate,
  onCreate,
  onClearSearch,
}: {
  rows: CustomerDirectoryRow[];
  loading: boolean;
  query: string;
  filter: CustomerDirectoryFilter;
  canCreate: boolean;
  onCreate: () => void;
  onClearSearch: () => void;
}) {
  if (loading) return <CustomerDirectorySkeleton />;
  if (!rows.length && (query.trim() || activeFilterCount(filter) > 0)) {
    return <CustomerDirectorySearchEmpty onClear={onClearSearch} />;
  }
  if (!rows.length) return <CustomerDirectoryEmpty canCreate={canCreate} onCreate={onCreate} />;
  return (
    <div className="customer-dir-list">
      {rows.map((customer) => (
        <CustomerRow key={customer.id} customer={customer} />
      ))}
    </div>
  );
}

export function useCustomerDirectorySearch(initial = "") {
  const [query, setQuery] = useState(initial);
  const debounced = useDebounced(query);
  return { query, setQuery, debouncedQuery: debounced };
}

export function useCustomerDirectoryView(
  rows: CustomerDirectoryRow[],
  filter: CustomerDirectoryFilter,
  opts: { query?: string; sites?: SiteOut[] } = {},
) {
  const filtered = useMemo(() => {
    const byFilter = filterDirectoryRows(rows, filter);
    return filterDirectoryByQuery(byFilter, opts.query ?? "", opts.sites ?? []);
  }, [rows, filter, opts.query, opts.sites]);
  const summary = useMemo(() => summarizeDirectory(rows), [rows]);
  return { filtered, summary };
}

export type { CustomerOut };

import { Button, ErrorState, Input, PageHeader, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, type ReactNode } from "react";
import { he } from "../i18n/he";

export { useMutation, useQuery, ErrorState, Button, Status };

export function ModuleScaffold({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={lead} />
      {children}
    </div>
  );
}

export function SearchCreateBar({
  query,
  onQuery,
  canCreate,
  creating,
  onToggleCreate,
  createLabel,
}: {
  query: string;
  onQuery: (value: string) => void;
  canCreate: boolean;
  creating: boolean;
  onToggleCreate: () => void;
  createLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <Input id="module-search" label={he.search} value={query} onChange={(ev) => onQuery(ev.target.value)} />
      </div>
      {canCreate ? (
        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={onToggleCreate}>
          {creating ? he.cancel : createLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyRows({ message }: { message: string }) {
  return <p className="text-sm text-fg-muted">{message}</p>;
}

type SimpleRow = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
};

export function SimpleEntityTable({
  rows,
  empty,
  statusLabel,
}: {
  rows: SimpleRow[];
  empty: string;
  statusLabel?: (status: string) => string;
}) {
  if (!rows.length) return <EmptyRows message={empty} />;
  return (
    <Table>
      <THead>
        <TR>
          <TH>{he.name}</TH>
          <TH>{he.status}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={row.id}>
            <TD>
              <span className="font-medium text-fg">{row.title}</span>
              {row.meta ? <p className="mt-0.5 text-xs text-fg-muted">{row.meta}</p> : null}
            </TD>
            <TD>{row.status ? <Status label={statusLabel?.(row.status) ?? row.status} /> : "—"}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function CreatePanel({
  open,
  onSubmit,
  pending,
  error,
  children,
}: {
  open: boolean;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  error: string | null;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-bg p-4" onSubmit={onSubmit}>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? he.saving : he.save}
      </Button>
    </form>
  );
}

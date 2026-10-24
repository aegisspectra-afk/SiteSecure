import { Button, Input, Select, Table, TBody, TD, TH, THead, Tooltip, TR, Textarea } from "@site-secure/ui";
import type { SspSiteOut } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CreatePanel, EmptyRows, ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { sspSiteToneClass } from "../../../lib/ssp-dashboard-view";
import { sspOfficeCodeMenuItems } from "../../../lib/ssp-unit-login-copy";
import {
  nextSspOfficeSort,
  sortSspOffices,
  sspOfficeActivation,
  sspOfficeActivationClass,
  sspOfficeFiltersActive,
  sspOfficeWarningDetail,
  sspOfficeWarningSummary,
  sspOfficeWarnings,
  sspOfficesListState,
  type SspOfficeSortDir,
  type SspOfficeSortKey,
} from "../../../lib/ssp-offices-view";

export const Route = createFileRoute("/app/ssp/offices")({
  component: SspOfficesPage,
});

function kindLabel(kind?: string) {
  if (kind === "ops_center") return he.sspSiteKindOps;
  return he.sspSiteKindOffice;
}

function activationLabel(status?: string | null) {
  const kind = sspOfficeActivation(status);
  if (kind === "pending") return he.sspActivationAwaiting;
  if (kind === "issued") return he.sspActivationCodeIssued;
  if (kind === "active") return he.sspActivationDeviceActive;
  return "";
}

function stopRowNav(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

function copyTextFallback(value: string) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.insetInlineStart = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function useWideOfficesLayout() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 640px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

function SspOfficesPage() {
  const { api, workspaceId, canEdit, isOfficer, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"office" | "ops_center">("office");
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SspOfficeSortKey>("name");
  const [sortDir, setSortDir] = useState<SspOfficeSortDir>("asc");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const wideLayout = useWideOfficesLayout();

  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, q, "actors", kindFilter, statusFilter],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSites(workspaceId!, {
        q: q.trim() || undefined,
        kind: kindFilter || "office,ops_center",
        is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
      }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspSite(workspaceId!, {
        name: name.trim(),
        code: code.trim() || undefined,
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
        kind,
      }),
    onSuccess: async () => {
      setCreating(false);
      setName("");
      setCode("");
      setPhone("");
      setDescription("");
      setKind("office");
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  const schemaUnavailable = list.data?.data_mode === "unavailable" || list.isError;
  const createReady = canEdit && !schemaUnavailable && list.isSuccess;
  const filterActive = sspOfficeFiltersActive(q, kindFilter, statusFilter);
  const items = sortSspOffices(list.data?.items ?? [], sortKey, sortDir);
  const listState = sspOfficesListState({
    loading: list.isLoading,
    error: list.isError || schemaUnavailable,
    itemCount: items.length,
    filterActive,
  });

  function openCreate() {
    setCreating(true);
    setFormError(null);
  }

  function clearFilters() {
    setQ("");
    setKindFilter("");
    setStatusFilter("");
  }

  function toggleSort(key: SspOfficeSortKey) {
    const next = nextSspOfficeSort(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  }

  async function copySiteId(value: string) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        copyTextFallback(value);
      }
    } catch {
      try {
        copyTextFallback(value);
      } catch {
        /* still show a short confirmation so the action is acknowledged */
      }
    }
    setCopiedId(value);
  }

  function openOffice(siteId: string) {
    void navigate({ to: "/app/ssp/sites/$siteId", params: { siteId } });
  }

  return (
    <div data-testid="ssp-offices">
      <ModuleScaffold
        title={he.sspNavOffices}
        lead={he.sspOfficesLead}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button
                type="button"
                disabled={!creating && !createReady}
                title={!creating && !createReady ? he.sspCreateBlocked : undefined}
                onClick={() => {
                  setCreating((value) => !value);
                  setFormError(null);
                }}
              >
                {creating ? he.cancel : he.sspNewActor}
              </Button>
            ) : null}
            <SspHubLinks
              variant="menu"
              items={[
                { to: "/app/ssp/users", label: he.sspNavPeople },
                ...(!isOfficer ? [{ to: "/app/ssp/unit-codes" as const, label: he.sspUnitCodesTitle }] : []),
                ...(sspCan("ssp.officers.view") ? [{ to: "/app/ssp/officers" as const, label: he.sspNavOfficers }] : []),
                { to: "/app/ssp/organization", label: he.sspNavOrganization },
                ...(!isOfficer ? [{ to: "/app/ssp/sites" as const, label: he.sspNavCustomerSites }] : []),
              ]}
            />
          </div>
        }
      >
        <CreatePanel
          open={creating}
          pending={create.isPending}
          error={formError}
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!name.trim()) return;
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="new-actor-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} required />
            <Input id="new-actor-code" label={he.sspOfficeCode} value={code} onChange={(e) => setCode(e.target.value)} />
            <Input id="new-actor-phone" label={he.sspSitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Select id="new-actor-kind" label={he.sspSiteKind} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="office">{he.sspSiteKindOffice}</option>
              <option value="ops_center">{he.sspSiteKindOps}</option>
            </Select>
          </div>
          <Textarea
            id="new-actor-desc"
            label="תיאור"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </CreatePanel>

        <div className="ssp-offices-filters" role="search">
          <Input id="office-search" label={he.search} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select id="office-kind" label={he.sspFilterKind} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="">{he.sspNavOffices}</option>
            <option value="office">{he.sspSiteKindOffice}</option>
            <option value="ops_center">{he.sspSiteKindOps}</option>
          </Select>
          <Select
            id="office-status"
            label={he.sspFilterStatus}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">הכול</option>
            <option value="active">{he.sspSiteActive}</option>
            <option value="inactive">{he.sspSiteInactive}</option>
          </Select>
          {filterActive ? (
            <Button type="button" variant="secondary" onClick={clearFilters}>
              {he.sspClearFilters}
            </Button>
          ) : null}
        </div>

        {listState === "loading" ? <EmptyRows message={he.loading} /> : null}
        {listState === "error" ? (
          <ErrorState
            title={he.apiUnavailable}
            description={he.sspWaitingLocalDb}
            action={
              <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {listState === "empty" ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6">
            <p className="text-base font-semibold text-fg">{he.sspNoActors}</p>
            {canEdit ? (
              <Button type="button" onClick={openCreate}>
                {he.sspNewActor}
              </Button>
            ) : null}
          </div>
        ) : null}
        {listState === "no-results" ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-offices-no-results">
            <p className="text-base font-semibold text-fg">{he.sspNoFilterResults}</p>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              {he.sspClearFilters}
            </Button>
          </div>
        ) : null}
        {listState === "rows" ? (
          <section className="space-y-3" aria-label={he.sspOfficesCount(items.length)}>
            <h2 className="ssp-offices-count">{he.sspOfficesCount(items.length)}</h2>
            <p className="ssp-offices-live" aria-live="polite">
              {copiedId ? he.sspIdCopied : ""}
            </p>
            {wideLayout ? (
              <OfficesTable
                items={items}
                sortKey={sortKey}
                sortDir={sortDir}
                canEdit={canEdit}
                copiedId={copiedId}
                onSort={toggleSort}
                onCopyId={copySiteId}
                onOpen={openOffice}
              />
            ) : (
              <OfficesCards
                items={items}
                canEdit={canEdit}
                copiedId={copiedId}
                onCopyId={copySiteId}
                onOpen={openOffice}
              />
            )}
          </section>
        ) : null}
      </ModuleScaffold>
    </div>
  );
}

function OfficesTable({
  items,
  sortKey,
  sortDir,
  canEdit,
  copiedId,
  onSort,
  onCopyId,
  onOpen,
}: {
  items: SspSiteOut[];
  sortKey: SspOfficeSortKey;
  sortDir: SspOfficeSortDir;
  canEdit: boolean;
  copiedId: string | null;
  onSort: (key: SspOfficeSortKey) => void;
  onCopyId: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const columns: Array<{ key: SspOfficeSortKey; label: string }> = [
    { key: "name", label: he.name },
    { key: "kind", label: he.sspFilterKind },
    { key: "status", label: he.status },
    { key: "activation", label: he.sspActivationColumn },
    { key: "members", label: he.sspMembersShort },
    { key: "forms", label: he.sspFormsShort },
  ];

  return (
    <div className="ssp-offices-table" data-testid="ssp-offices-table">
      <Table>
        <THead>
          <TR>
            {columns.map((col) => {
              const active = sortKey === col.key;
              return (
                <TH
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    className={`ssp-offices-sort${active ? " is-active" : ""}`}
                    onClick={() => onSort(col.key)}
                    aria-label={he.sspSortBy(col.label)}
                  >
                    <span>{col.label}</span>
                    {active ? (
                      <span className={`ssp-offices-sort-arrow is-${sortDir}`} aria-hidden>
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    ) : null}
                  </button>
                </TH>
              );
            })}
            <TH scope="col">{he.actions}</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((site, index) => (
            <TR
              key={site.id}
              className="ssp-offices-row"
              tabIndex={0}
              aria-label={he.sspOfficeRowAria(site.name)}
              onClick={() => onOpen(site.id)}
              onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(site.id);
                }
              }}
            >
              <TD>
                <div className="ssp-offices-name">
                  <span className="font-medium text-fg">{site.name}</span>
                  <OfficeWarning site={site} />
                </div>
              </TD>
              <TD>
                <span className="ssp-site-tone is-quiet">{kindLabel(site.kind)}</span>
              </TD>
              <TD>
                <span className="ssp-site-tone is-quiet">
                  {site.is_active ? he.sspSiteActive : he.sspSiteInactive}
                </span>
              </TD>
              <TD>
                {activationLabel(site.activation_status) ? (
                  <span className={sspOfficeActivationClass(site.activation_status)}>
                    {activationLabel(site.activation_status)}
                  </span>
                ) : (
                  <span className="text-fg-muted">—</span>
                )}
              </TD>
              <TD className="tabular-nums">{site.members_count ?? 0}</TD>
              <TD className="tabular-nums">{site.assigned_forms_count ?? 0}</TD>
              <TD>
                <OfficeActions
                  site={site}
                  canEdit={canEdit}
                  copied={copiedId === (site.site_id || site.code || site.id)}
                  menuUp={index === items.length - 1}
                  onCopy={() => void onCopyId(site.site_id || site.code || site.id)}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function OfficesCards({
  items,
  canEdit,
  copiedId,
  onCopyId,
  onOpen,
}: {
  items: SspSiteOut[];
  canEdit: boolean;
  copiedId: string | null;
  onCopyId: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="ssp-offices-cards" data-testid="ssp-offices-cards">
      {items.map((site, index) => (
        <li key={site.id}>
          <article
            className="ssp-offices-card"
            tabIndex={0}
            aria-label={he.sspOfficeRowAria(site.name)}
            onClick={() => onOpen(site.id)}
            onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(site.id);
              }
            }}
          >
            <div className="ssp-offices-name">
              <p className="font-medium text-fg">{site.name}</p>
              <div className="ssp-offices-card-tags">
                <span className="ssp-site-tone is-quiet">{kindLabel(site.kind)}</span>
                <span className="ssp-site-tone is-quiet">
                  {site.is_active ? he.sspSiteActive : he.sspSiteInactive}
                </span>
                {activationLabel(site.activation_status) ? (
                  <span className={sspOfficeActivationClass(site.activation_status)}>
                    {activationLabel(site.activation_status)}
                  </span>
                ) : null}
                <OfficeWarning site={site} />
              </div>
            </div>
            <p className="ssp-offices-card-meta">
              {he.sspMembersShort} {site.members_count ?? 0} · {he.sspFormsShort} {site.assigned_forms_count ?? 0}
            </p>
            <OfficeActions
              site={site}
              canEdit={canEdit}
              copied={copiedId === (site.site_id || site.code || site.id)}
              menuUp={index === items.length - 1}
              onCopy={() => void onCopyId(site.site_id || site.code || site.id)}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

function OfficeWarning({ site }: { site: SspSiteOut }) {
  const warnings = sspOfficeWarnings(site);
  const summary = sspOfficeWarningSummary(warnings);
  if (summary === "none") return null;
  const detail = sspOfficeWarningDetail(warnings, {
    noTeam: he.sspNoTeamAssigned,
    noForm: he.sspSiteNoFormAssigned,
  });
  const label =
    summary === "setup" ? he.sspSetupMissing : summary === "no_team" ? he.sspNoTeamAssigned : he.sspSiteNoFormAssigned;
  const chip =
    summary === "no_form" ? (
      <Link to="/app/ssp/assignments" className={sspSiteToneClass("no_form")} onClick={stopRowNav} onPointerDown={stopRowNav}>
        {label}
      </Link>
    ) : (
      <Link
        to="/app/ssp/sites/$siteId"
        params={{ siteId: site.id }}
        className={sspSiteToneClass("no_form")}
        onClick={stopRowNav}
        onPointerDown={stopRowNav}
      >
        {label}
      </Link>
    );
  if (summary !== "setup") return <span className="ssp-offices-warnings">{chip}</span>;
  return (
    <span className="ssp-offices-warnings">
      <Tooltip content={detail}>{chip}</Tooltip>
    </span>
  );
}

function OfficeActions({
  site,
  canEdit,
  copied,
  menuUp,
  onCopy,
}: {
  site: SspSiteOut;
  canEdit: boolean;
  copied: boolean;
  menuUp: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="ssp-offices-actions" onClick={stopRowNav} onPointerDown={stopRowNav}>
      <Link
        to="/app/ssp/sites/$siteId"
        params={{ siteId: site.id }}
        className="ssp-offices-action"
        aria-label={`${he.sspViewActor} ${site.name}`}
        onClick={stopRowNav}
        onPointerDown={stopRowNav}
      >
        {he.sspViewActor}
      </Link>
      {canEdit ? (
        <Link
          to="/app/ssp/sites/$siteId"
          params={{ siteId: site.id }}
          className="ssp-offices-action"
          aria-label={`${he.sspEditActor} ${site.name}`}
          onClick={stopRowNav}
          onPointerDown={stopRowNav}
        >
          {he.sspEditActor}
        </Link>
      ) : null}
      <RowMore name={site.name} copied={copied} menuUp={menuUp} onCopy={onCopy} />
    </div>
  );
}

function RowMore({
  name,
  copied,
  menuUp,
  onCopy,
}: {
  name: string;
  copied: boolean;
  menuUp: boolean;
  onCopy: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: globalThis.MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`ssp-offices-more${menuUp ? " is-up" : ""}`} ref={wrap}>
      <button
        type="button"
        className="ssp-offices-action"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${he.sspQuickMore} ${name}`}
        onClick={(event) => {
          stopRowNav(event);
          setOpen((value) => !value);
        }}
        onPointerDown={stopRowNav}
      >
        {he.sspQuickMore}
      </button>
      {open ? (
        <div className="ssp-quick-more-menu" role="menu">
          <button
            type="button"
            className="ssp-quick-more-item"
            role="menuitem"
            onClick={(event) => {
              stopRowNav(event);
              onCopy();
              setOpen(false);
            }}
            onPointerDown={stopRowNav}
          >
            {copied ? he.sspIdCopied : he.sspCopyId}
          </button>
          <Link
            to="/app/ssp/assignments"
            className="ssp-quick-more-item"
            role="menuitem"
            onClick={(event) => {
              stopRowNav(event);
              setOpen(false);
            }}
            onPointerDown={stopRowNav}
          >
            {he.sspQuickAssignForm}
          </Link>
          {sspOfficeCodeMenuItems().map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="ssp-quick-more-item"
              role="menuitem"
              onClick={(event) => {
                stopRowNav(event);
                setOpen(false);
              }}
              onPointerDown={stopRowNav}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

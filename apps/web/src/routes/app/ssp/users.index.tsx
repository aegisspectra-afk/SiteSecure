import { Button, Input, Modal, Select, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import type { SspPersonOut } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CreatePanel, EmptyRows, ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import {
  SspFilterBar,
  SspRowActionsMenu,
  SspSortHeader,
  SspStatusBadge,
  copySspText,
  sspRowKeyDown,
  stopSspRowNav,
  useSspWideLayout,
} from "../../../components/ssp/SspListKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";
import { planQuotaMessage } from "../../../lib/plan-quota";
import { productRoleLabelHe } from "../../../lib/ssp-product-authz";
import {
  nextSspUserSort,
  sortSspUsers,
  sspCanDisablePerson,
  sspUserDisplayName,
  sspUserFiltersActive,
  sspUserOfficeTag,
  sspUserRoleTone,
  sspUsersListState,
  type SspUserSortDir,
  type SspUserSortKey,
} from "../../../lib/ssp-users-view";

export const Route = createFileRoute("/app/ssp/users/")({
  component: SspPeoplePage,
});

function SspPeoplePage() {
  const { api, workspaceId, canEdit, sspCan, isOfficer } = useSspWorkspace();
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const wideLayout = useSspWideLayout();
  const canManage = sspCan("ssp.members.manage") || sspCan("ssp.members.manage_department");
  const actorUserId = user?.id ?? null;
  const [q, setQ] = useState("");
  const [siteId, setSiteId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [productRole, setProductRole] = useState<"org_admin" | "patrol_manager" | "patrol_officer">(
    "patrol_officer",
  );
  const [officeId, setOfficeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SspUserSortKey>("name");
  const [sortDir, setSortDir] = useState<SspUserSortDir>("asc");
  const [pendingDisable, setPendingDisable] = useState<SspPersonOut | null>(null);

  const offices = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center" }),
    retry: false,
  });

  const list = useQuery({
    queryKey: ["ssp-people", workspaceId, q, siteId, role, status],
    enabled: Boolean(workspaceId) && !isOfficer,
    queryFn: () =>
      api.listSspUsers(workspaceId!, {
        q: q.trim() || undefined,
        site_id: siteId || undefined,
        product_role: role || undefined,
        status: status || undefined,
      }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspUser(workspaceId!, {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        product_role: productRole,
        site_id: officeId || undefined,
      }),
    onSuccess: async () => {
      setCreating(false);
      setIssuedPassword(password);
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setProductRole("patrol_officer");
      setOfficeId("");
      setFormError(null);
      setSuccess(he.sspUserCreated);
      await qc.invalidateQueries({ queryKey: ["ssp-people", workspaceId] });
    },
    onError: (e: unknown) => {
      setSuccess(null);
      setIssuedPassword(null);
      setFormError(planQuotaMessage(e) ?? (e instanceof Error ? e.message : he.apiUnavailable));
    },
  });

  const patchStatus = useMutation({
    mutationFn: ({ person, next }: { person: SspPersonOut; next: "active" | "inactive" }) =>
      api.patchSspUser(workspaceId!, person.user_id, { status: next }),
    onSuccess: async () => {
      setPendingDisable(null);
      await qc.invalidateQueries({ queryKey: ["ssp-people", workspaceId] });
    },
  });

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (isOfficer) {
    return (
      <ModuleScaffold title={he.sspNavPeople} lead={he.sspPeopleLead}>
        <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />
      </ModuleScaffold>
    );
  }

  const schemaUnavailable = list.data?.data_mode === "unavailable" || list.isError;
  const createReady = canManage && !schemaUnavailable && list.isSuccess;
  const filterActive = sspUserFiltersActive(q, siteId, role, status);
  const items = sortSspUsers(
    (list.data?.items ?? []).map((person) => ({
      ...person,
      officeName: person.sites.map((site) => site.name).filter(Boolean).join(", "),
    })),
    sortKey,
    sortDir,
  );
  const listState = sspUsersListState({
    loading: list.isLoading,
    error: list.isError || schemaUnavailable,
    itemCount: items.length,
    filterActive,
  });

  function openCreate() {
    setCreating(true);
    setFormError(null);
    setSuccess(null);
  }

  function clearFilters() {
    setQ("");
    setSiteId("");
    setRole("");
    setStatus("");
  }

  function toggleSort(key: SspUserSortKey) {
    const next = nextSspUserSort(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  }

  async function copyValue(value: string) {
    const ok = await copySspText(value);
    if (ok) setCopied(value);
  }

  function openPerson(userId: string) {
    void navigate({ to: "/app/ssp/users/$userId", params: { userId } });
  }

  return (
    <div data-testid="ssp-people">
      <ModuleScaffold
        title={he.sspNavPeople}
        lead={he.sspPeopleLead}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <Button
                type="button"
                disabled={!creating && !createReady}
                title={!creating && !createReady ? he.sspCreateBlocked : undefined}
                onClick={() => {
                  setCreating((value) => !value);
                  setFormError(null);
                }}
              >
                {creating ? he.cancel : he.sspNewUser}
              </Button>
            ) : null}
            <SspHubLinks
              variant="menu"
              items={[
                { to: "/app/ssp/offices", label: he.sspNavOffices },
                { to: "/app/ssp/organization", label: he.sspNavOrganization },
                ...(sspCan("ssp.officers.view") ? [{ to: "/app/ssp/officers" as const, label: he.sspNavOfficers }] : []),
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
            if (!fullName.trim() || !email.trim()) {
              setFormError(he.required);
              return;
            }
            if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
              setFormError(he.sspPasswordRule);
              return;
            }
            create.mutate();
          }}
        >
          <p className="text-sm text-fg-muted">{he.sspPeopleCreateHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="new-user-name"
              label={he.fullName}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              hint={he.sspDisplayNameHint}
              required
            />
            <Input
              id="new-user-email"
              label={he.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint={he.sspLoginEmailHint}
              required
            />
            <Input id="new-user-phone" label={he.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input
              id="new-user-password"
              label={he.sspInitialPassword}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={he.sspPasswordRule}
              required
            />
            <Select
              id="new-user-role"
              label={he.sspProductRole}
              value={productRole}
              onChange={(e) => setProductRole(e.target.value as typeof productRole)}
            >
              <option value="patrol_officer">{he.sspRolePatrolOfficer}</option>
              {canEdit ? <option value="patrol_manager">{he.sspRolePatrolManager}</option> : null}
              {sspCan("ssp.members.manage") ? <option value="org_admin">{he.sspRoleOrgAdmin}</option> : null}
            </Select>
            <Select id="new-user-office" label={he.sspFilterOffice} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
              <option value="">{he.sspOfficeOptional}</option>
              {(offices.data?.items ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          </div>
        </CreatePanel>

        {success ? <p className="text-sm text-fg">{success}</p> : null}
        {issuedPassword ? (
          <div className="ssp-users-temp" data-testid="ssp-users-temp-password">
            <p className="text-sm font-medium text-fg">{he.sspTempPasswordOnce}</p>
            <code className="ssp-users-temp-code">{issuedPassword}</code>
            <Button type="button" variant="secondary" onClick={() => void copyValue(issuedPassword)}>
              {copied === issuedPassword ? he.sspIdCopied : he.sspUnitCopy}
            </Button>
          </div>
        ) : null}

        <SspFilterBar>
          <Input id="people-search" label={he.search} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select id="people-office" label={he.sspFilterOffice} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{he.catalogStatusAll}</option>
            {(offices.data?.items ?? []).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          <Select id="people-role" label={he.sspFilterRole} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{he.catalogStatusAll}</option>
            <option value="org_admin">{he.sspRoleOrgAdmin}</option>
            <option value="patrol_manager">{he.sspRolePatrolManager}</option>
            <option value="patrol_officer">{he.sspRolePatrolOfficer}</option>
          </Select>
          <Select id="people-status" label={he.sspFilterStatus} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{he.catalogStatusAll}</option>
            <option value="active">{he.sspSiteActive}</option>
            <option value="inactive">{he.sspSiteInactive}</option>
          </Select>
          {filterActive ? (
            <div className="ssp-list-filter-meta">
              {status === "active" ? <span className="ssp-list-filter-chip">{he.sspFilteredActive}</span> : null}
              <Button type="button" variant="secondary" onClick={clearFilters}>
                {he.sspClearFilters}
              </Button>
            </div>
          ) : null}
        </SspFilterBar>

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
            <p className="text-base font-semibold text-fg">{he.sspNoPeople}</p>
            {canManage ? (
              <Button type="button" onClick={openCreate}>
                {he.sspNewUser}
              </Button>
            ) : null}
          </div>
        ) : null}
        {listState === "no-results" ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-users-no-results">
            <p className="text-base font-semibold text-fg">{he.sspNoFilterResults}</p>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              {he.sspClearFilters}
            </Button>
          </div>
        ) : null}
        {listState === "rows" ? (
          <section className="space-y-3" aria-label={he.sspUsersCount(items.length)}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ssp-list-count">{he.sspUsersCount(items.length)}</h2>
              <span className="ssp-list-tip" tabIndex={0} title={he.sspPeopleVsOfficeTip}>
                ?
              </span>
            </div>
            <p className="ssp-list-live" aria-live="polite">
              {copied ? he.sspIdCopied : ""}
            </p>
            {wideLayout ? (
              <UsersTable
                items={items}
                sortKey={sortKey}
                sortDir={sortDir}
                canManage={canManage}
                actorUserId={actorUserId}
                copied={copied}
                onSort={toggleSort}
                onCopy={copyValue}
                onOpen={openPerson}
                onReset={openPerson}
                onToggleStatus={(person) => {
                  if (person.status === "active") setPendingDisable(person);
                  else patchStatus.mutate({ person, next: "active" });
                }}
              />
            ) : (
              <UsersCards
                items={items}
                canManage={canManage}
                actorUserId={actorUserId}
                copied={copied}
                onCopy={copyValue}
                onOpen={openPerson}
                onReset={openPerson}
                onToggleStatus={(person) => {
                  if (person.status === "active") setPendingDisable(person);
                  else patchStatus.mutate({ person, next: "active" });
                }}
              />
            )}
          </section>
        ) : null}
      </ModuleScaffold>
      <Modal
        open={Boolean(pendingDisable)}
        onClose={() => setPendingDisable(null)}
        title={he.deactivateUser}
      >
        <p className="mb-4 text-sm text-fg">{he.sspConfirmDisableUser(sspUserDisplayName(pendingDisable || { user_id: "" }))}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={patchStatus.isPending}
            onClick={() => pendingDisable && patchStatus.mutate({ person: pendingDisable, next: "inactive" })}
          >
            {he.deactivateUser}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPendingDisable(null)}>
            {he.cancel}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function UsersTable({
  items,
  sortKey,
  sortDir,
  canManage,
  actorUserId,
  copied,
  onSort,
  onCopy,
  onOpen,
  onReset,
  onToggleStatus,
}: {
  items: Array<SspPersonOut & { officeName?: string }>;
  sortKey: SspUserSortKey;
  sortDir: SspUserSortDir;
  canManage: boolean;
  actorUserId: string | null;
  copied: string | null;
  onSort: (key: SspUserSortKey) => void;
  onCopy: (value: string) => void;
  onOpen: (id: string) => void;
  onReset: (id: string) => void;
  onToggleStatus: (person: SspPersonOut) => void;
}) {
  const columns: Array<{ key: SspUserSortKey; label: string }> = [
    { key: "name", label: he.sspNavPeople },
    { key: "role", label: he.sspProductRole },
    { key: "office", label: he.sspFilterOffice },
    { key: "status", label: he.status },
  ];

  return (
    <div className="ssp-list-table" data-testid="ssp-users-table">
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
                  <SspSortHeader
                    label={col.label}
                    active={active}
                    dir={sortDir}
                    onSort={() => onSort(col.key)}
                  />
                </TH>
              );
            })}
            <TH scope="col">{he.actions}</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((person, index) => (
            <TR
              key={person.user_id}
              className="ssp-list-row"
              tabIndex={0}
              aria-label={he.sspUserRowAria(sspUserDisplayName(person))}
              onClick={() => onOpen(person.user_id)}
              onKeyDown={(event) => sspRowKeyDown(event, () => onOpen(person.user_id))}
            >
              <TD>
                <UserIdentity person={person} />
              </TD>
              <TD>
                <SspStatusBadge tone={sspUserRoleTone(person.product_role)}>
                  {productRoleLabelHe(person.product_role)}
                </SspStatusBadge>
              </TD>
              <TD>
                <OfficeCell person={person} />
              </TD>
              <TD>
                <SspStatusBadge tone={person.status === "active" ? "quiet" : "pending"}>
                  {person.status === "active" ? he.sspSiteActive : he.sspSiteInactive}
                </SspStatusBadge>
              </TD>
              <TD>
                <UserActions
                  person={person}
                  canManage={canManage}
                  actorUserId={actorUserId}
                  copied={copied === (person.email || "")}
                  menuUp={index === items.length - 1}
                  onCopy={onCopy}
                  onReset={onReset}
                  onToggleStatus={onToggleStatus}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function UsersCards({
  items,
  canManage,
  actorUserId,
  copied,
  onCopy,
  onOpen,
  onReset,
  onToggleStatus,
}: {
  items: Array<SspPersonOut & { officeName?: string }>;
  canManage: boolean;
  actorUserId: string | null;
  copied: string | null;
  onCopy: (value: string) => void;
  onOpen: (id: string) => void;
  onReset: (id: string) => void;
  onToggleStatus: (person: SspPersonOut) => void;
}) {
  return (
    <ul className="ssp-list-cards" data-testid="ssp-users-cards">
      {items.map((person, index) => (
        <li key={person.user_id}>
          <article
            className="ssp-list-card"
            tabIndex={0}
            aria-label={he.sspUserRowAria(sspUserDisplayName(person))}
            onClick={() => onOpen(person.user_id)}
            onKeyDown={(event) => sspRowKeyDown(event, () => onOpen(person.user_id))}
          >
            <UserIdentity person={person} />
            <div className="ssp-list-card-tags">
              <SspStatusBadge tone={sspUserRoleTone(person.product_role)}>
                {productRoleLabelHe(person.product_role)}
              </SspStatusBadge>
              <OfficeCell person={person} />
              <SspStatusBadge tone={person.status === "active" ? "quiet" : "pending"}>
                {person.status === "active" ? he.sspSiteActive : he.sspSiteInactive}
              </SspStatusBadge>
            </div>
            <UserActions
              person={person}
              canManage={canManage}
              actorUserId={actorUserId}
              copied={copied === (person.email || "")}
              menuUp={index === items.length - 1}
              onCopy={onCopy}
              onReset={onReset}
              onToggleStatus={onToggleStatus}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

function UserIdentity({ person }: { person: SspPersonOut }) {
  return (
    <div className="ssp-list-name">
      <span className="font-medium text-fg">{sspUserDisplayName(person)}</span>
      {person.email ? <span className="ssp-list-email">{person.email}</span> : null}
    </div>
  );
}

function OfficeCell({ person }: { person: SspPersonOut }) {
  const tag = sspUserOfficeTag({ role: person.product_role, siteCount: person.sites.length });
  if (tag === "org") return <SspStatusBadge tone="quiet">{he.sspOfficeAllOrg}</SspStatusBadge>;
  if (tag === "unassigned") {
    return (
      <Link
        to="/app/ssp/users/$userId"
        params={{ userId: person.user_id }}
        className="ssp-site-tone is-no-form"
        onClick={stopSspRowNav}
        onPointerDown={stopSspRowNav}
      >
        {he.sspOfficeUnassignedWarn}
      </Link>
    );
  }
  return <span className="text-sm text-fg">{person.sites.map((site) => site.name).filter(Boolean).join(" · ")}</span>;
}

function UserActions({
  person,
  canManage,
  actorUserId,
  copied,
  menuUp,
  onCopy,
  onReset,
  onToggleStatus,
}: {
  person: SspPersonOut;
  canManage: boolean;
  actorUserId: string | null;
  copied: boolean;
  menuUp: boolean;
  onCopy: (value: string) => void;
  onReset: (id: string) => void;
  onToggleStatus: (person: SspPersonOut) => void;
}) {
  const canToggle = canManage && sspCanDisablePerson(actorUserId, person.user_id);
  return (
    <div className="ssp-list-actions" onClick={stopSspRowNav} onPointerDown={stopSspRowNav}>
      <Link
        to="/app/ssp/users/$userId"
        params={{ userId: person.user_id }}
        className="ssp-list-action"
        aria-label={`${he.sspViewActor} ${sspUserDisplayName(person)}`}
        onClick={stopSspRowNav}
        onPointerDown={stopSspRowNav}
      >
        {he.sspViewActor}
      </Link>
      {canManage ? (
        <Link
          to="/app/ssp/users/$userId"
          params={{ userId: person.user_id }}
          className="ssp-list-action"
          aria-label={`${he.sspEditActor} ${sspUserDisplayName(person)}`}
          onClick={stopSspRowNav}
          onPointerDown={stopSspRowNav}
        >
          {he.sspEditActor}
        </Link>
      ) : null}
      <SspRowActionsMenu
        name={sspUserDisplayName(person)}
        menuUp={menuUp}
        items={[
          {
            id: "copy",
            label: copied ? he.sspIdCopied : he.sspCopyEmail,
            disabled: !person.email,
            onClick: () => person.email && onCopy(person.email),
          },
          {
            id: "reset",
            label: he.sspResetPassword,
            disabled: !canManage,
            onClick: () => onReset(person.user_id),
          },
          {
            id: "toggle",
            label: person.status === "active" ? he.deactivateUser : he.activateUser,
            disabled: !canToggle,
            onClick: () => onToggleStatus(person),
          },
        ]}
      />
    </div>
  );
}

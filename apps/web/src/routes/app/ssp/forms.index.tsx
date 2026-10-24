import { Button, Input, Modal, Select, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import type { SspFormOut, SspSiteAssignmentOut } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CreatePanel, EmptyRows, ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import {
  SspFilterBar,
  SspRowActionsMenu,
  SspSortHeader,
  SspStatusBadge,
  sspRowKeyDown,
  stopSspRowNav,
  useSspWideLayout,
} from "../../../components/ssp/SspListKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import {
  countSspFormAssignments,
  countSspFormSubmissions,
  filterSspForms,
  nextSspFormSort,
  sortSspForms,
  sspFormCanAssign,
  sspFormCanDelete,
  sspFormFiltersActive,
  sspFormFiltersVisible,
  sspFormNeedsEditWarning,
  sspFormNextVersion,
  sspFormStatusTone,
  sspFormUnassigned,
  sspFormVersionKind,
  sspFormsListState,
  type SspFormSortDir,
  type SspFormSortKey,
} from "../../../lib/ssp-forms-view";

export const Route = createFileRoute("/app/ssp/forms/")({
  component: SspFormsPage,
});

function statusLabel(status: string) {
  if (status === "published") return he.sspStatusPublished;
  if (status === "archived") return he.sspStatusArchived;
  return he.sspStatusDraft;
}

function formatUpdated(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("he-IL");
}

function SspFormsPage() {
  const { api, workspaceId, canEdit, sspCan } = useSspWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wideLayout = useSspWideLayout();
  const canAssign = sspCan("ssp.assignments.manage");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "duplicate">("blank");
  const [createMenu, setCreateMenu] = useState(false);
  const createWrap = useRef<HTMLDivElement>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [sourceFormId, setSourceFormId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SspFormSortKey>("updated");
  const [sortDir, setSortDir] = useState<SspFormSortDir>("desc");
  const [pendingArchive, setPendingArchive] = useState<SspFormOut | null>(null);
  const [pendingEdit, setPendingEdit] = useState<SspFormOut | null>(null);

  const listQuery = useQuery({
    queryKey: ["ssp-forms", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspForms(workspaceId!),
    retry: false,
  });

  const assignments = useQuery({
    queryKey: ["ssp-site-assignments", workspaceId, "forms-list"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteAssignments(workspaceId!),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspForm(workspaceId!, {
        title: newTitle.trim(),
        description: newDescription.trim(),
      }),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      void navigate({ to: "/app/ssp/forms/$formId", params: { formId: form.id }, search: { preview: false } });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const duplicate = useMutation({
    mutationFn: (formId: string) => api.duplicateSspForm(workspaceId!, formId),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      void navigate({ to: "/app/ssp/forms/$formId", params: { formId: form.id }, search: { preview: false } });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const archive = useMutation({
    mutationFn: (formId: string) => api.archiveSspForm(workspaceId!, formId),
    onSuccess: async () => {
      setPendingArchive(null);
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  useEffect(() => {
    if (!createMenu) return;
    const onDoc = (event: MouseEvent) => {
      if (!createWrap.current?.contains(event.target as Node)) setCreateMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [createMenu]);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const assignmentRows: SspSiteAssignmentOut[] = assignments.isSuccess ? (assignments.data?.items ?? []) : [];
  const haveAssignmentData = assignments.isSuccess;
  const allItems = listQuery.data?.items ?? [];
  const filterActive = sspFormFiltersActive(q, status);
  const showFilters = sspFormFiltersVisible(allItems.length);
  const items = sortSspForms(
    filterSspForms(allItems, q, status).map((form) => ({
      ...form,
      activeAssignments: haveAssignmentData ? countSspFormAssignments(assignmentRows, form.id) : undefined,
      submissionCount: haveAssignmentData ? countSspFormSubmissions(assignmentRows, form.id) : undefined,
    })),
    sortKey,
    sortDir,
  );
  const listState = sspFormsListState({
    loading: listQuery.isLoading,
    error: listQuery.isError,
    itemCount: items.length,
    filterActive,
  });

  function openBlank() {
    setCreateMode("blank");
    setCreating(true);
    setCreateMenu(false);
    setError(null);
  }

  function openDuplicate() {
    setCreateMode("duplicate");
    setCreating(true);
    setCreateMenu(false);
    setSourceFormId(allItems[0]?.id || "");
    setError(null);
  }

  function openForm(form: SspFormOut, preview = false) {
    if (!preview && sspFormNeedsEditWarning(form.status)) {
      setPendingEdit(form);
      return;
    }
    void navigate({
      to: "/app/ssp/forms/$formId",
      params: { formId: form.id },
      search: { preview },
    });
  }

  function toggleSort(key: SspFormSortKey) {
    const next = nextSspFormSort(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  }

  return (
    <div data-testid="ssp-forms">
      <ModuleScaffold
        title={he.sspNavFormsBuilder}
        lead={he.sspFormTemplatesLead}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              creating ? (
                <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                  {he.cancel}
                </Button>
              ) : (
                <div className="ssp-hub-menu" ref={createWrap}>
                  <Button
                    type="button"
                    aria-expanded={createMenu}
                    aria-haspopup="menu"
                    onClick={() => setCreateMenu((value) => !value)}
                  >
                    {he.sspNewForm}
                  </Button>
                  {createMenu ? (
                    <div className="ssp-quick-more-menu" role="menu">
                      <button type="button" className="ssp-quick-more-item" role="menuitem" onClick={openBlank}>
                        {he.sspBlankForm}
                      </button>
                      {allItems.length ? (
                        <button type="button" className="ssp-quick-more-item" role="menuitem" onClick={openDuplicate}>
                          {he.sspDuplicateFromExisting}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
            <SspHubLinks
              variant="menu"
              items={[
                { to: "/app/ssp/assignments", label: he.sspNavAssignments },
                { to: "/app/ssp/templates", label: he.sspNavTemplatesHub },
              ]}
            />
          </div>
        }
      >
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <CreatePanel
          open={creating}
          pending={create.isPending || duplicate.isPending}
          error={error}
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (createMode === "duplicate") {
              if (!sourceFormId) {
                setError(he.required);
                return;
              }
              duplicate.mutate(sourceFormId);
              return;
            }
            if (!newTitle.trim()) {
              setError(he.required);
              return;
            }
            create.mutate();
          }}
        >
          {createMode === "duplicate" ? (
            <Select id="dup-form" label={he.sspSourceForm} value={sourceFormId} onChange={(e) => setSourceFormId(e.target.value)}>
              {allItems.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </Select>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="new-form-title"
                label={he.sspFormTitle}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <Input
                id="new-form-desc"
                label={he.sspFormDescription}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          )}
        </CreatePanel>

        {showFilters ? (
          <SspFilterBar>
            <Input id="forms-search" label={he.search} value={q} onChange={(e) => setQ(e.target.value)} />
            <Select id="forms-status" label={he.sspFilterStatus} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{he.catalogStatusAll}</option>
              <option value="draft">{he.sspStatusDraft}</option>
              <option value="published">{he.sspStatusPublished}</option>
              <option value="archived">{he.sspStatusArchived}</option>
            </Select>
            {filterActive ? (
              <div className="ssp-list-filter-meta">
                {status ? <span className="ssp-list-filter-chip">{he.sspFilteredStatus(statusLabel(status))}</span> : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setStatus("");
                  }}
                >
                  {he.sspClearFilters}
                </Button>
              </div>
            ) : null}
          </SspFilterBar>
        ) : null}

        {listState === "loading" ? <EmptyRows message={he.loading} /> : null}
        {listState === "error" ? (
          <ErrorState
            title={he.apiUnavailable}
            action={
              <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {listState === "empty" ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-no-forms">
            <p className="text-base font-semibold text-fg">{he.sspNoForms}</p>
            {canEdit ? (
              <Button type="button" onClick={openBlank}>
                {he.sspFirstForm}
              </Button>
            ) : null}
          </div>
        ) : null}
        {listState === "no-results" ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-forms-no-results">
            <p className="text-base font-semibold text-fg">{he.sspNoFilterResults}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQ("");
                setStatus("");
              }}
            >
              {he.sspClearFilters}
            </Button>
          </div>
        ) : null}
        {listState === "rows" ? (
          <section className="space-y-3" aria-label={he.sspFormsCount(items.length)}>
            <h2 className="ssp-list-count">{he.sspFormsCount(items.length)}</h2>
            {wideLayout ? (
              <FormsTable
                items={items}
                sortKey={sortKey}
                sortDir={sortDir}
                haveAssignmentData={haveAssignmentData}
                canEdit={canEdit}
                canAssign={canAssign}
                onSort={toggleSort}
                onOpen={openForm}
                onDuplicate={(form) => duplicate.mutate(form.id)}
                onArchive={setPendingArchive}
              />
            ) : (
              <FormsCards
                items={items}
                haveAssignmentData={haveAssignmentData}
                canEdit={canEdit}
                canAssign={canAssign}
                onOpen={openForm}
                onDuplicate={(form) => duplicate.mutate(form.id)}
                onArchive={setPendingArchive}
              />
            )}
          </section>
        ) : null}
      </ModuleScaffold>
      <Modal open={Boolean(pendingArchive)} onClose={() => setPendingArchive(null)} title={he.sspArchive}>
        <p className="mb-4 text-sm text-fg">{he.sspConfirmArchiveForm(pendingArchive?.title || "")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={archive.isPending}
            onClick={() => pendingArchive && archive.mutate(pendingArchive.id)}
          >
            {he.sspArchive}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPendingArchive(null)}>
            {he.cancel}
          </Button>
        </div>
      </Modal>
      <Modal open={Boolean(pendingEdit)} onClose={() => setPendingEdit(null)} title={he.sspEditActor}>
        <p className="mb-4 text-sm text-fg">
          {pendingEdit
            ? he.sspEditPublishedWarn(
                sspFormNextVersion(pendingEdit.latest_published_version),
                pendingEdit.latest_published_version || 1,
              )
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              if (!pendingEdit) return;
              const form = pendingEdit;
              setPendingEdit(null);
              void navigate({ to: "/app/ssp/forms/$formId", params: { formId: form.id }, search: { preview: false } });
            }}
          >
            {he.sspEditActor}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setPendingEdit(null)}>
            {he.cancel}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

type FormRow = SspFormOut & { activeAssignments?: number; submissionCount?: number };

function FormsTable({
  items,
  sortKey,
  sortDir,
  haveAssignmentData,
  canEdit,
  canAssign,
  onSort,
  onOpen,
  onDuplicate,
  onArchive,
}: {
  items: FormRow[];
  sortKey: SspFormSortKey;
  sortDir: SspFormSortDir;
  haveAssignmentData: boolean;
  canEdit: boolean;
  canAssign: boolean;
  onSort: (key: SspFormSortKey) => void;
  onOpen: (form: SspFormOut, preview?: boolean) => void;
  onDuplicate: (form: SspFormOut) => void;
  onArchive: (form: SspFormOut) => void;
}) {
  const columns = useMemo(() => {
    const cols: Array<{ key: SspFormSortKey; label: string }> = [
      { key: "name", label: he.sspFormTitle },
      { key: "status", label: he.status },
      { key: "version", label: he.sspFormVersion },
    ];
    if (haveAssignmentData) cols.push({ key: "assignments", label: he.sspNavAssignments });
    cols.push({ key: "updated", label: he.sspUpdatedAt });
    return cols;
  }, [haveAssignmentData]);

  return (
    <div className="ssp-list-table" data-testid="ssp-forms-table">
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
                  <SspSortHeader label={col.label} active={active} dir={sortDir} onSort={() => onSort(col.key)} />
                </TH>
              );
            })}
            {haveAssignmentData ? <TH scope="col">{he.sspSubmissions}</TH> : null}
            <TH scope="col">{he.actions}</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((form, index) => (
            <TR
              key={form.id}
              className="ssp-list-row"
              tabIndex={0}
              aria-label={he.sspFormRowAria(form.title)}
              onClick={() => onOpen(form)}
              onKeyDown={(event) => sspRowKeyDown(event, () => onOpen(form))}
            >
              <TD>
                <div className="ssp-list-name">
                  <span className="font-medium text-fg">{form.title}</span>
                  {form.category ? <span className="ssp-list-email">{form.category}</span> : null}
                </div>
              </TD>
              <TD>
                <StatusCell form={form} />
              </TD>
              <TD>
                <VersionCell form={form} />
              </TD>
              {haveAssignmentData ? <TD>{form.activeAssignments ?? 0}</TD> : null}
              {haveAssignmentData ? <TD>{form.submissionCount ?? 0}</TD> : null}
              <TD>{formatUpdated(form.updated_at)}</TD>
              <TD>
                <FormActions
                  form={form}
                  canEdit={canEdit}
                  canAssign={canAssign}
                  menuUp={index === items.length - 1}
                  onOpen={onOpen}
                  onDuplicate={onDuplicate}
                  onArchive={onArchive}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function FormsCards({
  items,
  haveAssignmentData,
  canEdit,
  canAssign,
  onOpen,
  onDuplicate,
  onArchive,
}: {
  items: FormRow[];
  haveAssignmentData: boolean;
  canEdit: boolean;
  canAssign: boolean;
  onOpen: (form: SspFormOut, preview?: boolean) => void;
  onDuplicate: (form: SspFormOut) => void;
  onArchive: (form: SspFormOut) => void;
}) {
  return (
    <ul className="ssp-list-cards" data-testid="ssp-forms-cards">
      {items.map((form, index) => (
        <li key={form.id}>
          <article
            className="ssp-list-card"
            tabIndex={0}
            aria-label={he.sspFormRowAria(form.title)}
            onClick={() => onOpen(form)}
            onKeyDown={(event) => sspRowKeyDown(event, () => onOpen(form))}
          >
            <div className="ssp-list-name">
              <span className="font-medium text-fg">{form.title}</span>
              {form.category ? <span className="ssp-list-email">{form.category}</span> : null}
            </div>
            <div className="ssp-list-card-tags">
              <StatusCell form={form} />
              <VersionCell form={form} />
              {haveAssignmentData ? (
                <span className="text-xs text-fg-muted">
                  {he.sspNavAssignments}: {form.activeAssignments ?? 0} · {he.sspSubmissions}: {form.submissionCount ?? 0}
                </span>
              ) : null}
              <span className="text-xs text-fg-muted">{formatUpdated(form.updated_at)}</span>
            </div>
            <FormActions
              form={form}
              canEdit={canEdit}
              canAssign={canAssign}
              menuUp={index === items.length - 1}
              onOpen={onOpen}
              onDuplicate={onDuplicate}
              onArchive={onArchive}
            />
          </article>
        </li>
      ))}
    </ul>
  );
}

function StatusCell({ form }: { form: FormRow }) {
  return (
    <div className="ssp-list-card-tags">
      <SspStatusBadge tone={sspFormStatusTone(form.status)}>{statusLabel(form.status)}</SspStatusBadge>
      {sspFormUnassigned(form.status, form.activeAssignments) ? (
        <SspStatusBadge tone="warning">{he.sspUnassignedForm}</SspStatusBadge>
      ) : null}
    </div>
  );
}

function VersionCell({ form }: { form: SspFormOut }) {
  if (sspFormVersionKind(form.latest_published_version) === "unpublished") {
    return <span className="text-sm text-fg-muted">{he.sspVersionUnpublished}</span>;
  }
  return <span className="text-sm text-fg">v{form.latest_published_version}</span>;
}

function FormActions({
  form,
  canEdit,
  canAssign,
  menuUp,
  onOpen,
  onDuplicate,
  onArchive,
}: {
  form: FormRow;
  canEdit: boolean;
  canAssign: boolean;
  menuUp: boolean;
  onOpen: (form: SspFormOut, preview?: boolean) => void;
  onDuplicate: (form: SspFormOut) => void;
  onArchive: (form: SspFormOut) => void;
}) {
  const canAssignThis = canAssign && sspFormCanAssign(form.status);
  return (
    <div className="ssp-list-actions" onClick={stopSspRowNav} onPointerDown={stopSspRowNav}>
      {canEdit ? (
        <button type="button" className="ssp-list-action" onClick={() => onOpen(form)}>
          {he.sspEditActor}
        </button>
      ) : null}
      <button type="button" className="ssp-list-action" onClick={() => onOpen(form, true)}>
        {he.sspPreview}
      </button>
      {canEdit ? (
        <button type="button" className="ssp-list-action" onClick={() => onDuplicate(form)}>
          {he.sspDuplicate}
        </button>
      ) : null}
      {canAssignThis ? (
        <Link
          to="/app/ssp/assignments"
          search={{ form: form.id }}
          className="ssp-list-action"
          onClick={stopSspRowNav}
          onPointerDown={stopSspRowNav}
        >
          {he.sspAssignShort}
        </Link>
      ) : (
        <button type="button" className="ssp-list-action" disabled title={he.sspPublishBeforeAssign}>
          {he.sspAssignShort}
        </button>
      )}
      <SspRowActionsMenu
        name={form.title}
        menuUp={menuUp}
        items={[
          {
            id: "archive",
            label: he.sspArchive,
            disabled: !canEdit || form.status === "archived",
            onClick: () => onArchive(form),
          },
          {
            id: "delete",
            label: he.sspDelete,
            disabled: !sspFormCanDelete({
              assignmentCount: form.activeAssignments ?? 0,
              submissionCount: form.submissionCount ?? 0,
            }),
            title: he.sspDeleteUnavailable,
          },
        ]}
      />
    </div>
  );
}

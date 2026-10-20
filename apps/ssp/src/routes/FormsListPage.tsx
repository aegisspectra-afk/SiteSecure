import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SspHubLinks } from "../components/SspHubLinks";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

function statusLabel(status: string) {
  if (status === "published") return he.sspStatusPublished;
  if (status === "archived") return he.sspStatusArchived;
  return he.sspStatusDraft;
}

export function FormsListPage() {
  const { api, workspaceId } = useSession();
  const { sspCan, productRole } = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const listQuery = useQuery({
    queryKey: ["ssp-forms", workspaceId, q, status, category],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspForms(workspaceId!, {
        q: q.trim() || undefined,
        status: status || undefined,
        category: category.trim() || undefined,
      }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspForm(workspaceId!, {
        title: title.trim() || he.sspNewForm,
        description: description.trim() || undefined,
        category: newCategory.trim() || undefined,
      }),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      void navigate({ to: "/forms/$formId", params: { formId: form.id } });
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : he.apiUnavailable);
    },
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const canEdit = sspCan("ssp.forms.edit");
  const isOfficer = productRole === "patrol_officer";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={he.navFormTemplates}
        description={he.formTemplatesLead}
        action={
          canEdit ? (
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {he.sspNewForm}
            </Button>
          ) : null
        }
      />
      <SspHubLinks items={[{ to: "/templates", label: he.navTemplatesHub }]} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input id="forms-q" label={he.sspSearch} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterStatus}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={he.filterStatus}
          >
            <option value="">הכול</option>
            <option value="draft">{he.sspStatusDraft}</option>
            <option value="published">{he.sspStatusPublished}</option>
            <option value="archived">{he.sspStatusArchived}</option>
          </select>
        </label>
        <Input
          id="forms-cat"
          label={he.sspCategory}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      {canEdit ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <Input id="new-form-title" label={he.name} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            id="new-form-cat"
            label={he.sspCategory}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <Input
            id="new-form-desc"
            label="תיאור"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>
      ) : null}
      {listQuery.isError ? (
        <ErrorState
          title={he.apiUnavailable}
          action={
            <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : null}
      {listQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {!listQuery.isLoading && !(listQuery.data?.items.length) ? (
        <p className="text-sm text-fg-muted" data-testid="ssp-no-forms">
          {he.sspNoForms}
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(listQuery.data?.items ?? []).map((form) => (
          <li key={form.id}>
            <Link
              to="/forms/$formId"
              params={{ formId: form.id }}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle"
            >
              <div>
                <div className="font-medium text-fg">{form.title}</div>
                <div className="text-xs text-fg-muted">
                  {isOfficer ? he.officerFill : statusLabel(form.status)}
                  {form.category ? ` · ${form.category}` : ""}
                </div>
              </div>
              <span className="text-xs text-fg-muted">
                {form.latest_published_version ? `v${form.latest_published_version}` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, Input, PageHeader, Select, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { addressLine } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { quoteCreateSearch } from "../../../lib/workflow-context";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/sites/$siteId")({
  component: SiteDetailPage,
});

function SiteDetailPage() {
  return (
    <RequirePermission permission="sites.view">
      <SiteDetailBody />
    </RequirePermission>
  );
}

function SiteDetailBody() {
  const { siteId } = Route.useParams();
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "sites.edit", features);
  const canUpload = can(membership?.role_key, "documents.upload", features);
  const canCreateQuote = can(membership?.role_key, "quotes.create", features);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("planned");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteQuery = useQuery({
    queryKey: ["site", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const row = await api.getSite(workspaceId!, siteId);
      if (!hydrated) {
        setName(row.name);
        setAddress(addressLine(row.address));
        setStatus(row.installation_status ?? "planned");
        setNotes(row.access_notes ?? "");
        setHydrated(true);
      }
      return row;
    },
  });
  const customerQuery = useQuery({
    queryKey: ["site-customer", workspaceId, siteQuery.data?.customer_id],
    enabled: Boolean(workspaceId && siteQuery.data?.customer_id),
    queryFn: () => api.getCustomer(workspaceId!, siteQuery.data!.customer_id),
  });
  const docsQuery = useQuery({
    queryKey: ["site-docs", workspaceId, siteId],
    enabled: Boolean(workspaceId) && can(membership?.role_key, "documents.view", features),
    queryFn: () => api.listDocuments(workspaceId!, { entity_type: "site", entity_id: siteId, limit: 100 }),
  });

  const save = useMutation({
    mutationFn: () =>
      api.patchSite(workspaceId!, siteId, {
        name: name.trim(),
        address: address.trim() ? { line: address.trim() } : {},
        installation_status: status,
        access_notes: notes.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, siteId] });
      void queryClient.invalidateQueries({ queryKey: ["sites", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = await api.createDocumentUpload(workspaceId!, {
        entity_type: "site",
        entity_id: siteId,
        kind: "document",
        mime_type: file.type || undefined,
        original_filename: file.name,
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(he.sitesError);
      await api.completeDocumentUpload(workspaceId!, intent.document_id, {
        byte_size: file.size,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-docs", workspaceId, siteId] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setError(err instanceof Error ? err.message : he.sitesError),
  });

  if (!workspaceId) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isError) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isLoading || !siteQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={siteQuery.data.name}
        description={he.sitesDetail}
        action={
          <div className="flex flex-wrap gap-2">
            {canCreateQuote && siteQuery.data.customer_id ? (
              <Button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/app/quotes/new",
                    search: quoteCreateSearch({
                      customerId: siteQuery.data.customer_id,
                      siteId,
                    }),
                  })
                }
              >
                {he.newQuoteAction}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/app/sites" })}>
              {he.navSiteFiles}
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-surface-muted/30 p-4 text-sm">
        <p className="text-fg-muted">{he.navCustomers}</p>
        {customerQuery.data ? (
          <Link
            to="/app/customers/$customerId"
            params={{ customerId: customerQuery.data.id }}
            className="font-medium text-fg hover:underline"
          >
            {customerQuery.data.display_name}
          </Link>
        ) : (
          <p className="text-fg">{siteQuery.data.customer_id}</p>
        )}
        {siteQuery.data.code ? <p className="mt-2 public-mono text-xs text-fg-muted">{siteQuery.data.code}</p> : null}
      </div>

      <form
        className="grid max-w-2xl gap-3"
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!canEdit) return;
          save.mutate();
        }}
      >
        <Input id="s-name" label={he.name} value={name} onChange={(ev) => setName(ev.target.value)} disabled={!canEdit} />
        <Input
          id="s-address"
          label={he.sitesAddress}
          value={address}
          onChange={(ev) => setAddress(ev.target.value)}
          disabled={!canEdit}
        />
        <Select
          id="s-status"
          label={he.sitesStatus}
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
          disabled={!canEdit}
        >
          <option value="planned">planned</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
          <option value="inactive">inactive</option>
        </Select>
        <Input
          id="s-notes"
          label={he.sitesAccessNotes}
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          disabled={!canEdit}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {canEdit ? (
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? he.saving : he.save}
          </Button>
        ) : null}
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-fg">{he.sitesDocuments}</h2>
          {canUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                {he.sitesUpload}
              </Button>
            </>
          ) : null}
        </div>
        {(docsQuery.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">{he.sitesNoDocs}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{he.name}</TH>
                <TH>{he.status}</TH>
              </TR>
            </THead>
            <TBody>
              {(docsQuery.data?.items ?? []).map((doc) => (
                <TR key={doc.id}>
                  <TD>
                    <button
                      type="button"
                      className="font-medium text-fg hover:underline"
                      onClick={async () => {
                        const { url } = await api.getDocumentUrl(workspaceId, doc.id);
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {doc.original_filename || doc.id}
                    </button>
                  </TD>
                  <TD>
                    <Status label={doc.kind} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}

import { ApiClientError } from "@site-secure/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  Input,
  ModuleScaffold,
  SearchCreateBar,
  SimpleEntityTable,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/knowledge/")({
  component: KnowledgePage,
});

function KnowledgePage() {
  return (
    <RequirePermission permission="knowledge.view">
      <KnowledgeBody />
    </RequirePermission>
  );
}

function KnowledgeBody() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "knowledge.edit", features);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["knowledge", workspaceId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listKnowledge(workspaceId!, { q, limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createKnowledge(workspaceId!, {
        title: title.trim(),
        body: body.trim(),
        category: category.trim() || "general",
      }),
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setBody("");
      setCategory("general");
      void queryClient.invalidateQueries({ queryKey: ["knowledge", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.knowledgeError),
  });

  if (!workspaceId) return <ErrorState title={he.knowledgeError} />;
  if (listQuery.isError) return <ErrorState title={he.knowledgeError} />;

  return (
    <ModuleScaffold title={he.knowledgeTitle} lead={he.knowledgeLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canEdit}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.knowledgeCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!title.trim() || !body.trim()) return;
          create.mutate();
        }}
      >
        <Input id="k-title" label={he.titleField} value={title} onChange={(ev) => setTitle(ev.target.value)} required />
        <Input
          id="k-category"
          label={he.knowledgeCategory}
          value={category}
          onChange={(ev) => setCategory(ev.target.value)}
        />
        <label className="block text-sm">
          <span className="mb-1 block text-fg-muted">{he.knowledgeBody}</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-border bg-bg px-3 py-2 text-fg"
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            required
          />
        </label>
      </CreatePanel>
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (
        <SimpleEntityTable
          empty={he.knowledgeEmpty}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            meta: row.category,
            status: "live",
          }))}
        />
      )}
    </ModuleScaffold>
  );
}

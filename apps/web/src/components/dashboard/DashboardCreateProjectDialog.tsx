import { ApiClientError, type DashboardItem } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";
import { ProjectFromQuoteDialog } from "../workflow/ProjectFromQuoteDialog";

/** Opens the existing project-from-quote dialog from a dashboard attention row. */
export function DashboardCreateProjectDialog({
  item,
  workspaceId,
  onClose,
}: {
  item: DashboardItem;
  workspaceId: string;
  onClose: () => void;
}) {
  const { api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState(item.site_id ?? "");
  const [error, setError] = useState<string | null>(null);

  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, item.entity_id],
    queryFn: () => api.getQuote(workspaceId, item.entity_id),
  });

  const customerId = quoteQuery.data?.customer_id ?? null;
  const sitesQuery = useQuery({
    queryKey: ["sites", workspaceId, customerId],
    enabled: Boolean(customerId) && !item.site_id,
    queryFn: () => api.listSites(workspaceId, { customer_id: customerId!, limit: 50 }),
  });

  useEffect(() => {
    if (item.site_id) setSelectedSiteId(item.site_id);
  }, [item.site_id]);

  const createProject = useMutation({
    mutationFn: (siteId?: string) =>
      api.createProjectFromQuote(workspaceId, {
        source_quote_id: item.entity_id,
        ...(siteId ? { site_id: siteId } : {}),
      }),
    onSuccess: (project) => {
      setError(null);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      void navigate({ to: "/app/projects/$projectId", params: { projectId: project.id } });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.status === 409) {
        const existingId = typeof err.details.project_id === "string" ? err.details.project_id : null;
        if (existingId) {
          onClose();
          void navigate({ to: "/app/projects/$projectId", params: { projectId: existingId } });
          return;
        }
      }
      setError(err instanceof ApiClientError ? err.message : he.projectsError);
    },
  });

  const siteId = item.site_id || quoteQuery.data?.site_id || null;
  const sites = (sitesQuery.data?.items ?? []).map((site) => {
    const addr = site.address;
    const line =
      addr && typeof addr === "object"
        ? String((addr as { line?: string; formatted?: string }).line || (addr as { formatted?: string }).formatted || "")
        : "";
    return {
      id: site.id,
      name: site.name,
      address: line || null,
    };
  });

  return (
    <ProjectFromQuoteDialog
      open
      onClose={onClose}
      mode="create"
      quoteNumber={item.number || quoteQuery.data?.number}
      siteId={siteId}
      sites={sites}
      selectedSiteId={selectedSiteId}
      onSiteChange={setSelectedSiteId}
      creating={createProject.isPending || quoteQuery.isLoading}
      error={error}
      onCreate={(picked) => createProject.mutate(picked || selectedSiteId || siteId || undefined)}
    />
  );
}

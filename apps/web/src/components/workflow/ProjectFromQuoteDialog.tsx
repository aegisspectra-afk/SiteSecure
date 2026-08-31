import { Briefcase, FileText, MapPin } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";

type SiteOption = { id: string; name: string; address?: string | null };

export function ProjectFromQuoteDialog({
  open,
  onClose,
  mode,
  quoteNumber,
  projectId,
  siteId,
  sites,
  selectedSiteId,
  onSiteChange,
  creating,
  error,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "exists";
  quoteNumber?: string | null;
  projectId?: string | null;
  siteId?: string | null;
  sites?: SiteOption[];
  selectedSiteId?: string;
  onSiteChange?: (siteId: string) => void;
  creating?: boolean;
  error?: string | null;
  onCreate: (siteId?: string) => void;
}) {
  const navigate = useNavigate();
  const title = mode === "exists" ? he.workflowProjectExistsTitle : he.workflowQuoteApprovedTitle;
  const body =
    mode === "exists"
      ? he.workflowProjectExistsBody
      : he.workflowQuoteApprovedBody(quoteNumber ?? "");
  const effectiveSiteId = siteId || selectedSiteId || "";
  const canCreate = Boolean(effectiveSiteId);

  function openProject() {
    if (!projectId) return;
    onClose();
    void navigate({ to: "/app/projects/$projectId", params: { projectId } });
  }

  function stayOnQuote() {
    onClose();
  }

  function openSite() {
    if (!effectiveSiteId) return;
    onClose();
    void navigate({ to: "/app/sites/$siteId", params: { siteId: effectiveSiteId } });
  }

  return (
    <QuoteFlowSheet open={open} onClose={onClose} title={title} subtitle={body}>
      <div className="flex flex-col gap-2.5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {mode === "create" ? (
          siteId ? (
            <button
              type="button"
              className="quote-flow-action is-recommended"
              data-autofocus
              disabled={creating}
              onClick={() => onCreate()}
            >
              <span className="quote-flow-action-icon" aria-hidden>
                <Briefcase className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-sm font-semibold text-fg">
                  {creating ? he.workflowCreatingProject : he.workflowCreateProject}
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowCreateProjectHint}</span>
              </span>
            </button>
          ) : (
            <>
              <p className="rounded-[var(--radius-control)] border border-border px-3 py-3 text-sm text-fg-muted">
                {he.cpqSelectSiteBeforeProject}
              </p>
              {sites?.length ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-fg">{he.workflowPickSite}</span>
                  <select
                    className="min-h-11 rounded-[var(--radius-control)] border border-border bg-bg px-3"
                    value={selectedSiteId || ""}
                    onChange={(event) => onSiteChange?.(event.target.value)}
                  >
                    <option value="">{he.workflowPickSitePlaceholder}</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                        {site.address ? ` · ${site.address}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-fg-muted">{he.workflowNoSiteAttached}</p>
              )}
              <button
                type="button"
                className="quote-flow-action is-recommended"
                data-autofocus
                disabled={creating || !canCreate}
                onClick={() => onCreate(selectedSiteId || undefined)}
              >
                <span className="quote-flow-action-icon" aria-hidden>
                  <Briefcase className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block text-sm font-semibold text-fg">
                    {creating ? he.workflowCreatingProject : he.workflowCreateProject}
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowCreateProjectHint}</span>
                </span>
              </button>
            </>
          )
        ) : (
          <button type="button" className="quote-flow-action is-recommended" data-autofocus onClick={openProject}>
            <span className="quote-flow-action-icon" aria-hidden>
              <Briefcase className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span className="block text-sm font-semibold text-fg">{he.workflowOpenProject}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowOpenProjectHint}</span>
            </span>
          </button>
        )}
        <button type="button" className="quote-flow-action is-muted" onClick={stayOnQuote} disabled={creating}>
          <span className="quote-flow-action-icon is-muted" aria-hidden>
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-start">
            <span className="block text-sm font-semibold text-fg">{he.workflowBackToQuote}</span>
            <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowBackToQuoteHint}</span>
          </span>
        </button>
        {effectiveSiteId ? (
          <button type="button" className="quote-flow-action is-muted" onClick={openSite} disabled={creating}>
            <span className="quote-flow-action-icon is-muted" aria-hidden>
              <MapPin className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span className="block text-sm font-semibold text-fg">{he.workflowViewSite}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowViewSiteHint}</span>
            </span>
          </button>
        ) : null}
      </div>
    </QuoteFlowSheet>
  );
}

import { Briefcase, FileText, MapPin } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";

export function ProjectFromQuoteDialog({
  open,
  onClose,
  mode,
  quoteNumber,
  projectId,
  siteId,
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
  creating?: boolean;
  error?: string | null;
  onCreate: () => void;
}) {
  const navigate = useNavigate();
  const title = mode === "exists" ? he.workflowProjectExistsTitle : he.workflowQuoteApprovedTitle;
  const body =
    mode === "exists"
      ? he.workflowProjectExistsBody
      : he.workflowQuoteApprovedBody(quoteNumber ?? "");

  function openProject() {
    if (!projectId) return;
    onClose();
    void navigate({ to: "/app/projects/$projectId", params: { projectId } });
  }

  function stayOnQuote() {
    onClose();
  }

  function openSite() {
    if (!siteId) return;
    onClose();
    void navigate({ to: "/app/sites/$siteId", params: { siteId } });
  }

  return (
    <QuoteFlowSheet open={open} onClose={onClose} title={title} subtitle={body}>
      <div className="flex flex-col gap-2.5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {mode === "create" ? (
          <button
            type="button"
            className="quote-flow-action is-recommended"
            data-autofocus
            disabled={creating}
            onClick={onCreate}
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
        {siteId ? (
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

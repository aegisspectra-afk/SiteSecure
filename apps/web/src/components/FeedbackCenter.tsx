import { Button, Input, Select, Textarea } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function FeedbackCenter() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const pagePath = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.searchStr ?? ""}`,
  });
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<"bug" | "feature" | "general">("bug");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useQuery({
    queryKey: ["feedback", membership?.workspace_id],
    enabled: open && Boolean(membership?.workspace_id),
    queryFn: () => api.listFeedback(membership!.workspace_id),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.createFeedback({
        workspace_id: membership!.workspace_id,
        report_type: reportType,
        title: title.trim(),
        body: body.trim(),
        severity,
        page_url: typeof window !== "undefined" ? `${window.location.origin}${pagePath}` : pagePath,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        viewport:
          typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        screenshot_url: screenshot.trim() || undefined,
      }),
    onSuccess: (row) => {
      setTicketId(row.ticket_id);
      setError(null);
      setTitle("");
      setBody("");
      setScreenshot("");
      void queryClient.invalidateQueries({ queryKey: ["feedback", membership?.workspace_id] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.feedbackError);
    },
  });

  if (!membership?.workspace_id) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 8) return;
    submit.mutate();
  }

  return (
    <>
      <button
        type="button"
        className="feedback-launcher"
        aria-label={he.feedbackOpen}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          setTicketId(null);
          setError(null);
        }}
      >
        <MessageSquarePlus className="size-5" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="feedback-layer">
              <button type="button" className="feedback-backdrop" aria-label={he.feedbackClose} onClick={() => setOpen(false)} />
              <section className="feedback-panel ops-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">FEEDBACK</p>
                    <h2 id={titleId} className="mt-1 text-base font-semibold text-fg">
                      {he.feedbackTitle}
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">{he.feedbackLead}</p>
                  </div>
                  <button type="button" className="feedback-close" aria-label={he.feedbackClose} onClick={() => setOpen(false)}>
                    <X className="size-4" aria-hidden />
                  </button>
                </header>
                {ticketId ? (
                  <div className="mt-5 rounded-[var(--radius-control)] border border-border bg-bg-subtle px-4 py-3">
                    <p className="text-sm font-medium text-fg">{he.feedbackSuccess}</p>
                    <p className="ltr-meta mt-1 text-sm text-fg-muted">
                      {he.feedbackTicket}: {ticketId}
                    </p>
                    <Button type="button" variant="secondary" className="mt-3" onClick={() => setTicketId(null)}>
                      {he.feedbackOpen}
                    </Button>
                  </div>
                ) : (
                  <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
                    <Select id="feedback-type" label={he.feedbackType} value={reportType} onChange={(ev) => setReportType(ev.target.value as typeof reportType)}>
                      <option value="bug">{he.feedbackTypeBug}</option>
                      <option value="feature">{he.feedbackTypeFeature}</option>
                      <option value="general">{he.feedbackTypeGeneral}</option>
                    </Select>
                    <Select id="feedback-severity" label={he.feedbackSeverity} value={severity} onChange={(ev) => setSeverity(ev.target.value)}>
                      <option value="low">{he.feedbackSeverityLow}</option>
                      <option value="medium">{he.feedbackSeverityMedium}</option>
                      <option value="high">{he.feedbackSeverityHigh}</option>
                      <option value="blocker">{he.feedbackSeverityBlocker}</option>
                    </Select>
                    <Input id="feedback-title" label={he.feedbackSubject} value={title} onChange={(ev) => setTitle(ev.target.value)} required minLength={3} />
                    <Textarea id="feedback-body" label={he.feedbackBody} value={body} onChange={(ev) => setBody(ev.target.value)} required minLength={8} rows={5} />
                    <Input id="feedback-shot" label={he.feedbackScreenshot} value={screenshot} onChange={(ev) => setScreenshot(ev.target.value)} />
                    {error ? <p className="text-sm text-danger">{error}</p> : null}
                    <Button type="submit" variant="primary" loading={submit.isPending}>
                      {he.feedbackSubmit}
                    </Button>
                  </form>
                )}
                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-medium text-fg-muted">{he.feedbackMyReports}</p>
                  {mine.data?.length ? (
                    <ul className="mt-2 flex flex-col gap-2">
                      {mine.data.slice(0, 5).map((row) => (
                        <li key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-fg">{row.title}</span>
                          <span className="ltr-meta shrink-0 text-xs text-fg-muted">{row.ticket_id}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-fg-muted">{he.feedbackEmpty}</p>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

import { Button, Input, Textarea } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { HelpCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { he } from "../i18n/he";
import { APP_VERSION } from "../lib/app-version";
import { useFocusTrap } from "../lib/use-focus-trap";
import { useSession } from "../lib/session";
import { KNOWLEDGE_ARTICLES } from "./public/marketing/enterprise/knowledge-articles";
import { MARKETING_ROUTES } from "./public/marketing/enterprise/marketing-routes";

const MIN_KNOWLEDGE = 3;
const showKnowledge = KNOWLEDGE_ARTICLES.length >= MIN_KNOWLEDGE;

/** In-app support center for authenticated /app users. */
export function FeedbackCenter() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const pagePath = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.searchStr ?? ""}`,
  });
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mine = useQuery({
    queryKey: ["feedback", membership?.workspace_id],
    enabled: open && Boolean(membership?.workspace_id),
    queryFn: () => api.listFeedback(membership!.workspace_id),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.createFeedback({
        workspace_id: membership!.workspace_id,
        report_type: "general",
        title: subject.trim(),
        body: [
          description.trim(),
          "",
          `---`,
          `app_version=${APP_VERSION}`,
          `route=${pagePath}`,
          `workspace_id=${membership!.workspace_id}`,
          `user_id=${session?.user_id ?? ""}`,
          `role=${membership?.role_key ?? ""}`,
        ].join("\n"),
        severity: "medium",
        page_url: typeof window !== "undefined" ? `${window.location.origin}${pagePath}` : pagePath,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        viewport:
          typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      }),
    onSuccess: (row) => {
      setTicketId(row.ticket_id);
      setError(null);
      setSubject("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["feedback", membership?.workspace_id] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.feedbackError);
    },
  });

  if (!membership?.workspace_id) return null;

  function close() {
    setOpen(false);
    window.setTimeout(() => fabRef.current?.focus(), 0);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (subject.trim().length < 3 || description.trim().length < 8) return;
    submit.mutate();
  }

  return (
    <>
      <button
        type="button"
        ref={fabRef}
        className="feedback-launcher"
        aria-label={he.supportCenterOpen}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          setTicketId(null);
          setError(null);
        }}
      >
        <HelpCircle className="size-6" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="feedback-layer">
              <button
                type="button"
                className="feedback-backdrop"
                aria-label={he.feedbackClose}
                tabIndex={-1}
                onClick={close}
              />
              <section
                ref={panelRef}
                className="feedback-panel ops-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id={titleId} className="mt-1 text-base font-semibold text-fg">
                      {he.supportCenterTitle}
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">{he.supportCenterLead}</p>
                  </div>
                  <button
                    type="button"
                    ref={closeBtnRef}
                    className="feedback-close"
                    aria-label={he.feedbackClose}
                    onClick={close}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </header>

                <p className="mt-4 rounded-[var(--radius-control)] border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
                  {he.supportCenterSla}
                </p>

                {ticketId ? (
                  <div className="mt-5 rounded-[var(--radius-control)] border border-border bg-bg-subtle px-4 py-3">
                    <p className="text-sm font-medium text-fg">{he.supportCenterSuccess}</p>
                    <p className="ltr-meta mt-1 text-sm text-fg-muted">
                      {he.feedbackTicket}: {ticketId}
                    </p>
                    <Button type="button" variant="secondary" className="mt-3" onClick={() => setTicketId(null)}>
                      {he.supportCenterAnother}
                    </Button>
                  </div>
                ) : (
                  <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
                    <Input
                      id="support-subject"
                      label={he.supportCenterSubject}
                      value={subject}
                      onChange={(ev) => setSubject(ev.target.value)}
                      required
                      minLength={3}
                    />
                    <Textarea
                      id="support-body"
                      label={he.supportCenterBody}
                      value={description}
                      onChange={(ev) => setDescription(ev.target.value)}
                      required
                      minLength={8}
                      rows={5}
                    />
                    {error ? <p className="text-sm text-danger">{error}</p> : null}
                    <Button type="submit" variant="primary" loading={submit.isPending}>
                      {he.supportCenterSubmit}
                    </Button>
                  </form>
                )}

                {showKnowledge ? (
                  <div className="mt-5 border-t border-border pt-4">
                    <Link
                      to={MARKETING_ROUTES.knowledge}
                      className="text-sm font-semibold text-action"
                      onClick={close}
                    >
                      {he.supportCenterKnowledge}
                    </Link>
                  </div>
                ) : null}

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

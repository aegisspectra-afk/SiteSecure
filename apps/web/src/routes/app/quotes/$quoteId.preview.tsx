import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { ApiClientError, type QuoteGap } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QuoteDocument } from "../../../components/quotes/document/QuoteDocument";
import { QuoteShareDialog } from "../../../components/quotes/QuoteShareDialog";
import { SendQuoteConfirm } from "../../../components/quotes/SendQuoteConfirm";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { downloadAndOpenPdf, downloadBlob, openPdfBlob } from "../../../lib/download-blob";
import { resolveQuoteRecipientPhone } from "../../../lib/quote-recipient-phone";
import {
  closeSharePlaceholder,
  openSharePlaceholderTab,
  resolveWhatsAppOpen,
} from "../../../lib/quote-whatsapp-share";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/$quoteId/preview")({
  component: QuotePreviewPage,
});

function QuotePreviewPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuotePreviewBody />
    </RequirePermission>
  );
}

function QuotePreviewBody() {
  const { quoteId } = Route.useParams();
  const navigate = useNavigate();
  const { session, api, loading } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canSend = can(membership?.role_key, "quotes.send", features);
  const [formError, setFormError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [whatsappPrompt, setWhatsappPrompt] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "print" | "share" | "whatsapp">(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const lock = useRef(false);

  const documentQuery = useQuery({
    queryKey: ["quote-document", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuoteDocument(workspaceId!, quoteId),
  });
  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuote(workspaceId!, quoteId),
  });

  useEffect(() => {
    if (!workspaceId || !quoteId || !documentQuery.data) return;
    void api.recordQuoteEvent(workspaceId, quoteId, { event_type: "preview_opened" }).catch(() => undefined);
  }, [api, workspaceId, quoteId, documentQuery.data?.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (shareOpen || confirmSend || whatsappPrompt) return;
      event.preventDefault();
      void navigate({ to: "/app/quotes/$quoteId", params: { quoteId } });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, quoteId, shareOpen, confirmSend, whatsappPrompt]);

  const send = useMutation({
    mutationFn: () => api.sendQuote(workspaceId!, quoteId),
    onSuccess: (row) => {
      setPublicUrl(row.public_url ?? "");
      setFormError(null);
      setConfirmSend(false);
      if (row.public_url) setShareOpen(true);
      void queryClient.invalidateQueries({ queryKey: ["quote", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quote-document", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
    },
    onError: (err) => {
      console.error("quote send failed", err);
      if (err instanceof ApiClientError && err.code === "QUOTE_INCOMPLETE") {
        setFormError(he.quoteSendBlocked);
        return;
      }
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });

  async function ensureLink() {
    if (publicUrl) return publicUrl;
    const shared = await api.shareQuote(workspaceId!, quoteId);
    setPublicUrl(shared.public_url);
    // Share must never imply "sent" — only refresh document/list if status actually changed.
    if (shared.status) {
      void queryClient.invalidateQueries({ queryKey: ["quote", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quote-document", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
    }
    return shared.public_url;
  }

  async function onDownloadPdf() {
    if (!workspaceId || lock.current) return;
    lock.current = true;
    setBusy("pdf");
    setFormError(null);
    try {
      const { blob, filename } = await api.downloadQuotePdf(workspaceId, quoteId);
      downloadAndOpenPdf(blob, filename);
    } catch (err) {
      console.error("preview pdf download failed", err);
      setFormError(err instanceof ApiClientError ? err.message : he.quotePdfFailed);
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  async function onPrint() {
    if (!workspaceId || lock.current) return;
    lock.current = true;
    setBusy("print");
    setFormError(null);
    try {
      const { blob } = await api.downloadQuotePdf(workspaceId, quoteId);
      openPdfBlob(blob);
    } catch (err) {
      console.error("preview pdf print failed", err);
      setFormError(err instanceof ApiClientError ? err.message : he.quotePdfFailed);
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  async function onOpenShare() {
    if (!workspaceId || lock.current) return;
    lock.current = true;
    setBusy("share");
    setFormError(null);
    try {
      await ensureLink();
      setShareOpen(true);
    } catch (err) {
      console.error("preview share failed", err);
      setFormError(err instanceof ApiClientError ? err.message : he.quoteShareFailed);
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  async function onWhatsApp(forcePicker = false) {
    if (!workspaceId || lock.current) return;
    const phoneDigits = resolveQuoteRecipientPhone({
      customerPhone: documentQuery.data?.customer?.phone,
    });
    if (!forcePicker && !phoneDigits) {
      setWhatsappPrompt(true);
      return;
    }
    lock.current = true;
    setBusy("whatsapp");
    setFormError(null);
    setWhatsappPrompt(false);
    const placeholder = openSharePlaceholderTab();
    try {
      const url = await ensureLink();
      try {
        const { blob, filename } = await api.downloadQuotePdf(workspaceId, quoteId);
        downloadBlob(blob, filename);
        void api.recordQuoteEvent(workspaceId, quoteId, { event_type: "pdf_generated" }).catch(() => undefined);
      } catch (pdfErr) {
        console.error("preview whatsapp pdf failed", pdfErr);
      }
      const name = documentQuery.data?.customer?.display_name || "";
      const result = resolveWhatsAppOpen(
        { customerName: name, publicUrl: url, phoneDigits, forcePicker },
        placeholder,
      );
      if (!result.ok) {
        if (result.reason === "no_phone") {
          setWhatsappPrompt(true);
          return;
        }
        setFormError(he.quoteWhatsAppPopupBlocked);
        setShareOpen(true);
        return;
      }
      void api
        .recordQuoteEvent(workspaceId, quoteId, {
          event_type: "whatsapp_share_initiated",
          metadata: { phone: result.phoneUsed },
        })
        .catch(() => undefined);
    } catch (err) {
      closeSharePlaceholder(placeholder);
      console.error("preview whatsapp failed", err);
      setFormError(err instanceof ApiClientError ? err.message : he.quoteShareFailed);
    } finally {
      setBusy(null);
      lock.current = false;
    }
  }

  if (loading || !workspaceId) return <LoadingBlock />;
  if (documentQuery.isLoading || quoteQuery.isLoading) {
    return <LoadingBlock label={he.quotePreviewPreparing} />;
  }
  if (documentQuery.isError || !documentQuery.data || quoteQuery.isError || !quoteQuery.data) {
    return <ErrorState title={he.quotesError} />;
  }

  const quote = quoteQuery.data;
  const gaps = (quote.validation?.gaps ?? []) as QuoteGap[];
  const canSendNow = canSend && quote.status === "draft" && gaps.length === 0;
  const doc = documentQuery.data;
  const editHref = { to: "/app/quotes/$quoteId" as const, params: { quoteId } };

  return (
    <div className={`quote-preview-viewer${fullscreen ? " is-fullscreen" : ""}`}>
      <div className="quote-preview-viewer-toolbar no-print">
        <Link
          {...editHref}
          className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-bg px-3 text-sm font-medium text-fg hover:bg-bg-subtle"
        >
          {he.quotePreviewBackShort}
        </Link>
        <p className="text-sm font-semibold text-fg">{he.quotePreview}</p>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}>
            {he.cpqPreviewZoomOut}
          </Button>
          <span className="ltr-meta text-xs text-fg-muted">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}>
            {he.cpqPreviewZoomIn}
          </Button>
          <Button variant="ghost" onClick={() => setZoom(1)}>
            {he.cpqPreviewFit}
          </Button>
          <Button variant="ghost" onClick={() => setFullscreen((v) => !v)}>
            {he.cpqPreviewFullscreen}
          </Button>
          <Button variant="secondary" loading={busy === "pdf"} disabled={Boolean(busy)} onClick={() => void onDownloadPdf()}>
            {he.quotePdfDownload}
          </Button>
          {canSend ? (
            <Button variant="secondary" loading={busy === "share"} disabled={Boolean(busy)} onClick={() => void onOpenShare()}>
              {he.cpqCopySecureLink}
            </Button>
          ) : null}
          {quote.status === "draft" && canSend ? (
            <Button disabled={!canSendNow || Boolean(busy)} onClick={() => setConfirmSend(true)}>
              {he.quoteSendToCustomer}
            </Button>
          ) : null}
        </div>
      </div>

      {formError ? <p className="no-print text-sm text-danger">{formError}</p> : null}
      {whatsappPrompt ? (
        <section className="no-print ops-card flex flex-col gap-3 p-4">
          <p className="text-sm font-semibold">{he.quoteWhatsAppNoPhoneTitle}</p>
          <p className="text-sm text-fg-muted">{he.quoteWhatsAppNoPhoneBody}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setWhatsappPrompt(false)}>
              {he.cancel}
            </Button>
            <Button
              onClick={() => {
                setWhatsappPrompt(false);
                void onWhatsApp(true);
              }}
            >
              {he.quoteWhatsAppOpenPicker}
            </Button>
          </div>
        </section>
      ) : null}
      {gaps.length ? (
        <section className="no-print ops-card flex flex-col gap-1 p-3">
          <p className="text-sm font-medium text-fg">{he.quoteSendBlocked}</p>
          {gaps.map((gap) => (
            <p key={`${gap.field}-${gap.code}`} className="text-sm text-fg-muted">
              {gap.message}
            </p>
          ))}
        </section>
      ) : null}

      <div className="quote-preview-viewer-stage">
        <div className="quote-preview-viewer-page" style={{ transform: `scale(${zoom})` }}>
          <QuoteDocument quote={doc} />
        </div>
      </div>

      <QuoteShareDialog
        open={shareOpen}
        url={publicUrl}
        customerName={doc.customer?.display_name || undefined}
        onClose={() => setShareOpen(false)}
        onWhatsApp={() => {
          setShareOpen(false);
          void onWhatsApp();
        }}
      />
      <SendQuoteConfirm
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => send.mutate()}
        onChannel={(channel) => {
          setConfirmSend(false);
          if (channel === "whatsapp") void onWhatsApp();
          else if (channel === "link") void onOpenShare();
          else if (channel === "email") void onOpenShare();
          else send.mutate();
        }}
        pending={send.isPending}
        customer={doc.customer?.display_name}
        number={doc.number}
        amount={doc.total_gross}
        currency={doc.currency}
        gaps={gaps}
        canSend={canSendNow}
      />
    </div>
  );
}

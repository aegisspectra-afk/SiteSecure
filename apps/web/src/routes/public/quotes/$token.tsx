import { Button, ErrorState, Input, LoadingBlock, Textarea } from "@site-secure/ui";
import type { PublicQuote } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LottieAnimation } from "../../../components/lottie";
import { QuoteDocument } from "../../../components/quotes/document/QuoteDocument";
import { SignaturePad } from "../../../components/quotes/SignaturePad";
import { he } from "../../../i18n/he";
import { downloadAndOpenPdf } from "../../../lib/download-blob";
import { formatDay, formatMoney } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/public/quotes/$token")({
  component: CustomerQuoteExperience,
});

type PortalStep = "review" | "sign" | "done";

function CustomerQuoteExperience() {
  const { token } = Route.useParams();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<PortalStep>("review");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const query = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => api.getPublicQuote(token),
    staleTime: 30_000,
  });

  const quote = query.data;
  const isApproved = quote?.status === "approved";

  const approve = useMutation({
    mutationFn: () =>
      api.approvePublicQuote(token, {
        name: name.trim() || undefined,
        terms_accepted: true,
        signature_data_url: signatureDataUrl || undefined,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    onSuccess: (row) => {
      setActionError(null);
      setStep("done");
      queryClient.setQueryData(["public-quote", token], row);
    },
    onError: () => setActionError(he.quotePublicError),
  });

  const reject = useMutation({
    mutationFn: () =>
      api.rejectPublicQuote(token, {
        reason: reason.trim() || undefined,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    onSuccess: (row) => {
      setActionError(null);
      setShowReject(false);
      queryClient.setQueryData(["public-quote", token], row);
    },
    onError: () => setActionError(he.quotePublicError),
  });

  const canSubmitSign = useMemo(
    () => termsAccepted && Boolean(name.trim()) && Boolean(signatureDataUrl),
    [termsAccepted, name, signatureDataUrl],
  );

  async function downloadPdf() {
    setPdfBusy(true);
    setActionError(null);
    try {
      const { blob, filename } = await api.downloadPublicQuotePdf(token);
      downloadAndOpenPdf(blob, filename);
    } catch (err) {
      console.error("public pdf failed", err);
      setActionError(he.quotePdfFailed);
    } finally {
      setPdfBusy(false);
    }
  }

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !quote) {
    return (
      <div className="cqx-portal public-root min-h-dvh p-6" dir="rtl">
        <ErrorState title={he.quotePublicError} />
      </div>
    );
  }

  const showSuccess = isApproved || step === "done";
  const brand = quote.company?.brand_name || quote.company?.name || he.brand;

  return (
    <div className="cqx-portal public-root min-h-dvh" dir="rtl">
      <header className="cqx-topbar">
        <div>
          <p className="cqx-brand">{brand}</p>
          <p className="cqx-kicker">{he.quotePublicTitle}</p>
        </div>
        <p className="cqx-number ltr-meta">#{quote.number}</p>
      </header>

      {showSuccess ? (
        <SuccessPanel quote={quote} onDownloadPdf={() => void downloadPdf()} pdfBusy={pdfBusy} />
      ) : (
        <>
          <main className="cqx-main">
            {quote.superseded ? <p className="cqx-banner is-danger">{he.quotePublicSuperseded}</p> : null}
            {quote.status === "rejected" ? (
              <p className="cqx-banner is-muted">{he.quotePublicRejected}</p>
            ) : null}
            {quote.status === "expired" ? (
              <p className="cqx-banner is-muted">{he.quotePublicExpired}</p>
            ) : null}
            {actionError ? <p className="cqx-banner is-danger">{actionError}</p> : null}

            <QuoteDocument quote={quote} showStatus={false} hideSignatureBlock />

            {step === "sign" && quote.can_approve ? (
              <section className="cqx-sign-card" id="cqx-sign">
                <h2>{he.cqxSignTitle}</h2>
                <p className="cqx-sign-lead">{he.cqxSignLead}</p>
                <label className="cqx-terms">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(ev) => setTermsAccepted(ev.target.checked)}
                  />
                  <span>{he.cqxTermsAccept}</span>
                </label>
                <Input
                  id="cqx-signer"
                  label={he.quotePublicSigner}
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  autoComplete="name"
                />
                <SignaturePad onChange={setSignatureDataUrl} disabled={approve.isPending} />
                <div className="cqx-sign-actions">
                  <Button variant="secondary" onClick={() => setStep("review")}>
                    {he.quoteDocApproveConfirmBack}
                  </Button>
                  <Button
                    loading={approve.isPending}
                    disabled={!canSubmitSign}
                    onClick={() => approve.mutate()}
                  >
                    {he.cqxConfirmSign}
                  </Button>
                </div>
                {!canSubmitSign ? <p className="cqx-hint">{he.cqxSignHint}</p> : null}
              </section>
            ) : null}

            {showReject && quote.can_reject ? (
              <section className="cqx-sign-card">
                <h2>{he.quotePublicReject}</h2>
                <Textarea
                  id="cqx-reason"
                  label={he.quotePublicReason}
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                />
                <div className="cqx-sign-actions">
                  <Button variant="secondary" onClick={() => setShowReject(false)}>
                    {he.cancel}
                  </Button>
                  <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>
                    {he.quotePublicReject}
                  </Button>
                </div>
              </section>
            ) : null}
          </main>

          {quote.can_approve && step === "review" ? (
            <div className="cqx-sticky">
              <div className="cqx-sticky-total">
                <span>{he.quoteTotalDue}</span>
                <strong>{formatMoney(quote.total_gross, quote.currency || "ILS")}</strong>
              </div>
              <div className="cqx-sticky-actions">
                <Button variant="secondary" loading={pdfBusy} onClick={() => void downloadPdf()}>
                  {he.quoteDocPrintPdf}
                </Button>
                <Button
                  onClick={() => {
                    setStep("sign");
                    window.setTimeout(() => {
                      document.getElementById("cqx-sign")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 50);
                  }}
                >
                  {he.cqxApproveCta}
                </Button>
              </div>
              {quote.can_reject ? (
                <button type="button" className="cqx-reject-link" onClick={() => setShowReject(true)}>
                  {he.quotePublicReject}
                </button>
              ) : null}
            </div>
          ) : null}

          {!quote.can_approve && !showSuccess ? (
            <div className="cqx-sticky is-simple">
              <Button variant="secondary" loading={pdfBusy} onClick={() => void downloadPdf()}>
                {he.quoteDocPrintPdf}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function SuccessPanel({
  quote,
  onDownloadPdf,
  pdfBusy,
}: {
  quote: PublicQuote;
  onDownloadPdf: () => void;
  pdfBusy: boolean;
}) {
  const approvedAt = formatDay(quote.approved_at);
  const signer = quote.approved_name || "—";
  return (
    <main className="cqx-success">
      <LottieAnimation name="success" size={88} />
      <h1>{he.cqxSuccessTitle}</h1>
      <p className="cqx-success-body">{he.cqxSuccessBody(quote.number)}</p>
      <dl className="cqx-success-meta">
        <div>
          <dt>{he.quoteDocSignDate}</dt>
          <dd>{approvedAt || "—"}</dd>
        </div>
        <div>
          <dt>{he.quotePublicSigner}</dt>
          <dd>{signer}</dd>
        </div>
        <div>
          <dt>{he.quoteTotalDue}</dt>
          <dd>{formatMoney(quote.total_gross, quote.currency || "ILS")}</dd>
        </div>
      </dl>
      <div className="cqx-success-actions">
        <Button loading={pdfBusy} onClick={onDownloadPdf}>
          {he.cqxDownloadQuote}
        </Button>
        <Button variant="secondary" loading={pdfBusy} onClick={onDownloadPdf}>
          {he.cqxDownloadSigned}
        </Button>
      </div>
      <p className="cqx-hint">{he.cqxLockedHint}</p>
    </main>
  );
}

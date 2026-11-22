import { ApiClientError, type ApiClient, type JobOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSingleFlight } from "../../lib/idempotency-key";
import { SignaturePad } from "../quotes/SignaturePad";

function formatSignedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * DEMO-4.1: the customer signs on the technician's device (touch), with the signer's name.
 * Once signed the job shows the signature image (private storage, short-lived URL), the name
 * and the date.
 */
export function JobSignatureSection({
  api,
  workspaceId,
  job,
  canSign,
  online,
  onSigned,
}: {
  api: ApiClient;
  workspaceId: string;
  job: Pick<JobOut, "id" | "status" | "customer_signature_document_id" | "customer_signer_name" | "customer_signed_at">;
  canSign: boolean;
  online: boolean;
  onSigned: () => void;
}) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resign, setResign] = useState(false);
  const flight = useSingleFlight();
  const docId = job.customer_signature_document_id ?? null;
  const onSite = job.status === "arrived" || job.status === "in_progress";

  const imageQuery = useQuery({
    queryKey: ["job-signature-url", workspaceId, docId],
    enabled: Boolean(docId),
    staleTime: 30_000,
    queryFn: () => api.getDocumentUrl(workspaceId, docId!),
  });

  const save = useMutation({
    mutationFn: () => api.signJob(workspaceId, job.id, { signer_name: name.trim(), signature_data_url: image! }),
    onSuccess: () => {
      setError(null);
      setResign(false);
      setImage(null);
      onSigned();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobSignatureError),
    onSettled: () => flight.end(),
  });

  const signed = Boolean(docId && job.customer_signed_at);
  const showForm = canSign && onSite && (!signed || resign);

  return (
    <section className="field-section" data-testid="job-signature" aria-labelledby="job-signature-title">
      <h2 id="job-signature-title" className="text-base font-semibold text-fg">
        {he.jobSignatureTitle}
      </h2>

      {signed && !resign ? (
        <div className="mt-3" data-testid="job-signature-done">
          {imageQuery.data?.url ? (
            <img
              src={imageQuery.data.url}
              alt={he.jobSignatureImageAlt(job.customer_signer_name ?? "")}
              className="h-28 w-full max-w-sm rounded border border-border bg-white object-contain"
            />
          ) : imageQuery.isError ? (
            <p className="text-xs text-danger">{he.jobSignatureImageError}</p>
          ) : (
            <p className="text-xs text-fg-muted">{he.loading}</p>
          )}
          <p className="mt-2 text-sm text-fg" data-testid="job-signature-signer">
            {he.jobSignatureSignedBy(job.customer_signer_name ?? "")}
          </p>
          <p className="text-xs text-fg-muted">{formatSignedAt(job.customer_signed_at!)}</p>
          {canSign && onSite ? (
            <Button type="button" variant="ghost" className="mt-2" onClick={() => setResign(true)}>
              {he.jobSignatureAgain}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!signed && !showForm ? (
        <p className="mt-2 text-sm text-fg-muted" data-testid="job-signature-missing">
          {onSite ? he.jobSignatureNotYet : he.jobSignatureWhenOnSite}
        </p>
      ) : null}

      {showForm ? (
        <div className="mt-3 flex flex-col gap-3" data-testid="job-signature-form">
          <label className="field-signature-label" htmlFor="job-signer-name">
            {he.jobSignatureSignerName}
            <input
              id="job-signer-name"
              className="field-control mt-1 w-full"
              value={name}
              maxLength={120}
              autoComplete="name"
              onChange={(ev) => setName(ev.target.value)}
            />
          </label>
          <SignaturePad onChange={setImage} disabled={save.isPending} label={he.jobSignaturePadLabel} />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-testid="job-signature-save"
              disabled={!name.trim() || !image || !online || save.isPending}
              loading={save.isPending}
              onClick={() => {
                if (flight.begin()) save.mutate();
              }}
            >
              {he.jobSignatureSave}
            </Button>
            {resign ? (
              <Button type="button" variant="secondary" onClick={() => setResign(false)}>
                {he.cancel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

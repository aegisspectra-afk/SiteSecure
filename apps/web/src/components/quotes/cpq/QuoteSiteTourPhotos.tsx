import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { he } from "../../../i18n/he";
import { uploadQuoteTourPhoto } from "../../../lib/quote-upload";
import { useSession } from "../../../lib/session";

const MAX_PHOTOS = 10;

/** B6 — mobile-friendly site tour photos on a draft quote (capture + gallery). */
export function QuoteSiteTourPhotos({
  workspaceId,
  quoteId,
  canEdit,
}: {
  workspaceId: string;
  quoteId: string;
  canEdit: boolean;
}) {
  const { api } = useSession();
  const qc = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const docs = useQuery({
    queryKey: ["quote-tour-photos", workspaceId, quoteId],
    enabled: Boolean(quoteId),
    queryFn: () =>
      api.listDocuments(workspaceId, {
        entity_type: "quote",
        entity_id: quoteId,
        kind: "photo",
        limit: MAX_PHOTOS,
      }),
  });

  const items = docs.data?.items ?? [];
  const atCap = items.length >= MAX_PHOTOS;

  async function onFiles(files: FileList | null) {
    if (!files?.length || !canEdit || !quoteId) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (items.length >= MAX_PHOTOS) break;
        await uploadQuoteTourPhoto(api, workspaceId, quoteId, file);
      }
      await qc.invalidateQueries({ queryKey: ["quote-tour-photos", workspaceId, quoteId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : he.quotesError);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  if (!quoteId) return null;

  return (
    <section className="ops-card p-3" data-testid="quote-site-tour-photos">
      <div className="mb-2">
        <p className="text-sm font-semibold text-fg">{he.quoteSiteTourTitle}</p>
        <p className="text-xs text-fg-muted">{he.quoteSiteTourHint}</p>
      </div>
      {items.length ? (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((doc) => (
            <li key={doc.id} className="overflow-hidden rounded border border-border bg-surface">
              <div className="flex aspect-square items-center justify-center text-[0.65rem] text-fg-muted">
                {doc.original_filename || he.quoteSiteTourPhoto}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-fg-muted">{he.quoteSiteTourEmpty}</p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="field-control min-h-12 px-3 text-sm font-semibold"
            disabled={busy || atCap}
            onClick={() => cameraRef.current?.click()}
          >
            {he.quoteSiteTourCamera}
          </button>
          <button
            type="button"
            className="field-control min-h-12 px-3 text-sm font-semibold"
            disabled={busy || atCap}
            onClick={() => galleryRef.current?.click()}
          >
            {he.quoteSiteTourGallery}
          </button>
          <span className="self-center text-xs text-fg-muted">
            {items.length}/{MAX_PHOTOS}
          </span>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(ev) => void onFiles(ev.target.files)}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(ev) => void onFiles(ev.target.files)}
          />
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}

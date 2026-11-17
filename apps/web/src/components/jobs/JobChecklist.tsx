import { ApiClientError, type ApiClient, type JobChecklistItem } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Camera, MessageSquare } from "lucide-react";
import { useId, useRef, useState } from "react";
import { he } from "../../i18n/he";

type Patch = { completed?: boolean; not_applicable?: boolean; notes?: string | null; photo_document_id?: string | null };

function timeHe(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Done = completed or "לא רלוונטי". Required left = required items not yet done. */
export function checklistProgress(items: JobChecklistItem[]) {
  const done = items.filter((i) => i.completed || i.not_applicable).length;
  const requiredLeft = items.filter((i) => i.required && !i.completed && !i.not_applicable).length;
  return { done, total: items.length, requiredLeft };
}

/**
 * DEMO-4.3: checklist with required items, a photo per item where the template asks, notes,
 * "לא רלוונטי" only where allowed, and who marked each item and when.
 */
export function JobChecklist({
  api,
  workspaceId,
  items,
  locked,
  online,
  onPatch,
  onUploadPhoto,
}: {
  api: ApiClient;
  workspaceId: string;
  items: JobChecklistItem[];
  locked: boolean;
  online: boolean;
  onPatch: (itemId: string, patch: Patch) => Promise<unknown>;
  onUploadPhoto: (file: File) => Promise<string>;
}) {
  const { done, total, requiredLeft } = checklistProgress(items);
  return (
    <section className="field-section" aria-labelledby="field-checklist" data-testid="job-checklist">
      <div className="flex items-center justify-between gap-3">
        <h2 id="field-checklist" className="text-base font-semibold text-fg">
          {he.installationChecklist}
        </h2>
        {total ? (
          <p className="text-xs text-fg-muted" data-testid="job-checklist-progress">
            <bdi className="tabular-nums">
              {done}/{total}
            </bdi>
            {requiredLeft > 0 ? ` · ${he.checklistRequiredLeft(requiredLeft)}` : ""}
          </p>
        ) : null}
      </div>
      <ul className="field-row-list mt-2">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            api={api}
            workspaceId={workspaceId}
            item={item}
            locked={locked || !online}
            onPatch={onPatch}
            onUploadPhoto={onUploadPhoto}
          />
        ))}
        {!items.length ? <li className="field-row-empty">{he.installationChecklistEmpty}</li> : null}
      </ul>
    </section>
  );
}

function ChecklistRow({
  api,
  workspaceId,
  item,
  locked,
  onPatch,
  onUploadPhoto,
}: {
  api: ApiClient;
  workspaceId: string;
  item: JobChecklistItem;
  locked: boolean;
  onPatch: (itemId: string, patch: Patch) => Promise<unknown>;
  onUploadPhoto: (file: File) => Promise<string>;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(Boolean(item.notes));
  const [notes, setNotes] = useState(item.notes ?? "");
  const needsPhoto = Boolean(item.photo_required && !item.photo_document_id);
  const marked = item.completed || item.not_applicable;

  const photoQuery = useQuery({
    queryKey: ["doc-url", workspaceId, item.photo_document_id],
    enabled: Boolean(item.photo_document_id),
    staleTime: 30_000,
    queryFn: () => api.getDocumentUrl(workspaceId, item.photo_document_id!),
  });

  // Actions on one row run in order: tapping V while the note box is open saves the note
  // (blur) and then the tick; a busy flag used to drop the second one silently.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  function run(patch: Patch) {
    setError(null);
    setBusy(true);
    const next = queue.current.then(async () => {
      try {
        await onPatch(item.id, patch);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : he.checklistSaveError);
      }
    });
    queue.current = next;
    void next.finally(() => {
      if (queue.current === next) setBusy(false);
    });
    return next;
  }

  async function pickPhoto(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const documentId = await onUploadPhoto(file);
      await onPatch(item.id, { photo_document_id: documentId });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : he.checklistPhotoError);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li className="field-check-item" data-testid="checklist-row" data-key={item.item_key ?? undefined}>
      <div className="field-check-row">
        <input
          id={`${id}-done`}
          type="checkbox"
          className="size-5 shrink-0"
          checked={Boolean(item.completed)}
          disabled={locked || item.not_applicable || (needsPhoto && !item.completed)}
          aria-describedby={needsPhoto ? `${id}-photo-hint` : undefined}
          onChange={(event) => void run({ completed: event.target.checked })}
        />
        <label htmlFor={`${id}-done`} className="min-w-0 flex-1">
          <span className={marked ? "text-fg-muted line-through" : "text-fg"}>{item.label_he}</span>
          {item.required ? <span className="checklist-badge">{he.checklistRequired}</span> : null}
          {item.not_applicable ? <span className="checklist-badge is-muted">{he.checklistNotApplicable}</span> : null}
        </label>
      </div>
      {item.help_he ? <p className="checklist-help">{item.help_he}</p> : null}
      {needsPhoto && !locked ? (
        <p id={`${id}-photo-hint`} className="checklist-help text-warning">
          {he.checklistPhotoNeeded}
        </p>
      ) : null}

      {item.photo_document_id ? (
        photoQuery.data?.url ? (
          <img
            src={photoQuery.data.url}
            alt={he.checklistPhotoAlt(item.label_he)}
            className="mt-2 h-20 w-28 rounded border border-border object-cover"
            data-testid="checklist-photo"
          />
        ) : (
          <p className="checklist-help">{he.loading}</p>
        )
      ) : null}

      {!locked ? (
        <div className="checklist-actions">
          {item.photo_required || item.photo_document_id ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                data-testid="checklist-photo-input"
                onChange={(ev) => void pickPhoto(ev.target.files?.[0])}
              />
              <Button type="button" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" aria-hidden />
                {item.photo_document_id ? he.checklistPhotoReplace : he.checklistPhotoAdd}
              </Button>
            </>
          ) : null}
          {item.allow_na ? (
            <Button
              type="button"
              variant="ghost"
              aria-pressed={Boolean(item.not_applicable)}
              disabled={busy}
              data-testid="checklist-na"
              onClick={() => void run({ not_applicable: !item.not_applicable })}
            >
              {item.not_applicable ? he.checklistUndoNotApplicable : he.checklistNotApplicable}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setNotesOpen((v) => !v)}>
            <MessageSquare className="size-4" aria-hidden />
            {he.checklistNote}
          </Button>
        </div>
      ) : null}

      {notesOpen && !locked ? (
        <label className="mt-2 block text-xs text-fg-muted">
          {he.checklistNote}
          <textarea
            className="field-notes mt-1"
            rows={2}
            maxLength={1000}
            value={notes}
            data-testid="checklist-notes"
            onChange={(ev) => setNotes(ev.target.value)}
            onBlur={() => {
              if ((item.notes ?? "") !== notes.trim()) void run({ notes: notes.trim() || null });
            }}
          />
        </label>
      ) : item.notes ? (
        <p className="checklist-help">
          {he.checklistNote}: {item.notes}
        </p>
      ) : null}

      {marked && (item.completed_by_name || item.completed_at) ? (
        <p className="checklist-help" data-testid="checklist-marked-by">
          {he.checklistMarkedBy(item.completed_by_name ?? he.unknownPerson, timeHe(item.completed_at))}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

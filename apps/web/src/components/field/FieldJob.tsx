import {
  ApiClientError,
  type DocumentOut,
  type EquipmentOut,
  type JobChecklistItem,
  type JobOut,
} from "@site-secure/api-client";
import { Button, ErrorState, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Camera, MapPin, Wrench } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { useOnlineStatus } from "../../lib/use-online-status";
import { useSession } from "../../lib/session";

function jobStatusLabel(status: string): string {
  return he.jobStatuses[status as keyof typeof he.jobStatuses] ?? status;
}

function jobStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "in_progress" || status === "en_route") return "warning";
  if (status === "scheduled") return "info";
  return "neutral";
}

function equipmentCategoryLabel(category: string): string {
  return he.equipmentCategories[category as keyof typeof he.equipmentCategories] ?? category;
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL");
}

export function FieldJob({ jobId }: { jobId: string }) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canUpload = can(roleKey, "documents.upload", features);
  const canViewDocs = can(roleKey, "documents.view", features);
  const canSystems = can(roleKey, "systems.view", features);
  const canStart = can(roleKey, "jobs.start", features);
  const canComplete = can(roleKey, "jobs.complete", features);

  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["job", workspaceId, jobId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getJob(workspaceId!, jobId),
  });

  const checklistQuery = useQuery({
    queryKey: ["job-checklist", workspaceId, jobId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listJobChecklist(workspaceId!, jobId),
  });

  const siteId = jobQuery.data?.site_id ?? null;

  const siteQuery = useQuery({
    queryKey: ["job-site", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId),
    queryFn: () => api.getSite(workspaceId!, siteId!),
  });

  const customerQuery = useQuery({
    queryKey: ["job-customer", workspaceId, jobQuery.data?.customer_id],
    enabled: Boolean(workspaceId && jobQuery.data?.customer_id),
    queryFn: () => api.getCustomer(workspaceId!, jobQuery.data!.customer_id!),
  });

  const equipmentQuery = useQuery({
    queryKey: ["job-equipment", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId && canSystems),
    queryFn: () => api.listEquipment(workspaceId!, siteId!),
  });

  const docsQuery = useQuery({
    queryKey: ["job-docs", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId && canViewDocs),
    queryFn: () => api.listDocuments(workspaceId!, { entity_type: "site", entity_id: siteId!, limit: 50 }),
  });

  const start = useMutation({
    mutationFn: () => api.startJob(workspaceId!, jobId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["job", workspaceId, jobId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });

  const complete = useMutation({
    mutationFn: () => api.completeJob(workspaceId!, jobId, { completion_notes: notes.trim() || undefined }),
    onSuccess: () => {
      setError(null);
      setCompleting(false);
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["job", workspaceId, jobId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      if (siteId) {
        void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, siteId] });
      }
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });

  const toggleItem = useMutation({
    mutationFn: (input: { itemId: string; completed: boolean }) =>
      api.patchJobChecklistItem(workspaceId!, jobId, input.itemId, { completed: input.completed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job-checklist", workspaceId, jobId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!siteId) throw new Error(he.fieldPhotoNeedsSite);
      const intent = await api.createDocumentUpload(workspaceId!, {
        entity_type: "site",
        entity_id: siteId,
        kind: "photo",
        mime_type: file.type || undefined,
        original_filename: file.name,
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(he.sitesError);
      await api.completeDocumentUpload(workspaceId!, intent.document_id, {
        byte_size: file.size,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job-docs", workspaceId, siteId] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setError(err instanceof Error ? err.message : he.sitesError),
  });

  if (!workspaceId) return <ErrorState title={he.jobLoadError} />;
  if (jobQuery.isError) {
    const msg = jobQuery.error instanceof ApiClientError ? jobQuery.error.message : he.jobLoadError;
    return <ErrorState title={msg} />;
  }
  if (jobQuery.isLoading || !jobQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  const job = jobQuery.data;
  const items = checklistQuery.data ?? [];
  const done = items.filter((item) => item.completed).length;
  const equipment = equipmentQuery.data?.items ?? [];
  const photos = (docsQuery.data?.items ?? []).filter(
    (doc) => doc.kind === "photo" || (doc.mime_type ?? "").startsWith("image/"),
  );
  const scheduled = formatTime(job.scheduled_for);
  const canStartJob = canStart && (job.status === "scheduled" || job.status === "en_route");
  const canCompleteJob = canComplete && job.status === "in_progress";
  const jobDone = job.status === "completed";

  return (
    <div className="field-job">
      <div className="field-job-nav">
        <Link to="/app/today" className="text-sm text-fg-muted hover:text-fg">
          ← {he.navToday}
        </Link>
        {siteId ? (
          <Link
            to="/app/sites/$siteId"
            params={{ siteId }}
            className="text-sm text-fg-muted hover:text-fg"
          >
            {he.sitesDetail}
          </Link>
        ) : null}
      </div>

      {!online ? (
        <div className="field-offline-banner" role="status">
          <p className="text-sm font-medium text-fg">{he.fieldOfflineTitle}</p>
          <p className="mt-1 text-xs text-fg-muted">{he.fieldOfflineBody}</p>
        </div>
      ) : null}

      <header className="field-job-hero">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.fieldJobKicker}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg">{job.title}</h1>
        <p className="public-mono mt-2 text-xs text-fg-muted" dir="ltr">
          {job.number}
          {job.kind ? ` · ${job.kind}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Status label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
          {scheduled ? (
            <p className="public-mono text-sm text-fg-muted" dir="ltr">
              {scheduled}
            </p>
          ) : null}
        </div>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="field-job-primary">
        {canStartJob ? (
          <Button type="button" loading={start.isPending} disabled={!online} onClick={() => start.mutate()}>
            {he.startJob}
          </Button>
        ) : null}
        {canCompleteJob && !completing ? (
          <Button type="button" variant="secondary" disabled={!online} onClick={() => setCompleting(true)}>
            {he.completeJob}
          </Button>
        ) : null}
      </div>

      <section className="field-section" aria-labelledby="field-where">
        <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldWhereKicker}</p>
        <h2 id="field-where" className="mt-1 text-base font-semibold text-fg">
          {siteQuery.data?.name || he.fieldSiteUnknown}
        </h2>
        {customerQuery.data?.display_name ? (
          <p className="mt-1 text-sm text-fg-muted">{customerQuery.data.display_name}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {siteId ? (
            <Link to="/app/sites/$siteId" params={{ siteId }} className="field-chip">
              <MapPin className="size-4" aria-hidden />
              {he.fieldOpenSite}
            </Link>
          ) : null}
          {customerQuery.data?.phone ? (
            <a className="field-chip" href={`tel:${customerQuery.data.phone}`}>
              {he.siteFieldCall}
            </a>
          ) : null}
        </div>
      </section>

      <ChecklistSection
        items={items}
        done={done}
        locked={jobDone || !online}
        pending={toggleItem.isPending}
        onToggle={(itemId, completed) => toggleItem.mutate({ itemId, completed })}
      />

      <EquipmentSection items={equipment} loading={equipmentQuery.isLoading} />

      <PhotosSection
        photos={photos}
        canUpload={Boolean(canUpload && siteId && !jobDone)}
        uploading={upload.isPending}
        online={online}
        fileRef={fileRef}
        onPick={() => fileRef.current?.click()}
        onFile={(file) => upload.mutate(file)}
      />

      {completing && canCompleteJob ? (
        <section className="field-section field-complete-panel" aria-labelledby="field-complete">
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldCompleteKicker}</p>
          <h2 id="field-complete" className="mt-1 text-base font-semibold text-fg">
            {he.completeJob}
          </h2>
          <label className="mt-3 block text-xs text-fg-muted" htmlFor="completion-notes">
            {he.fieldCompletionNotes}
          </label>
          <textarea
            id="completion-notes"
            className="field-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={he.fieldCompletionNotesHint}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={complete.isPending}
              disabled={!online}
              onClick={() => complete.mutate()}
            >
              {he.fieldConfirmComplete}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCompleting(false)}>
              {he.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      {jobDone ? (
        <section className="field-section">
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldCompleteKicker}</p>
          <p className="mt-2 text-sm text-fg">{he.fieldJobCompleted}</p>
          {job.completed_at ? (
            <p className="mt-1 text-xs text-fg-muted">{formatDate(job.completed_at)}</p>
          ) : null}
          {job.completion_notes ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-fg-muted">{job.completion_notes}</p>
          ) : null}
        </section>
      ) : null}

      {/* Keep JobOut typed usage for future fields */}
      <JobMetaFoot job={job} />
    </div>
  );
}

function ChecklistSection({
  items,
  done,
  locked,
  pending,
  onToggle,
}: {
  items: JobChecklistItem[];
  done: number;
  locked: boolean;
  pending: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
}) {
  return (
    <section className="field-section" aria-labelledby="field-checklist">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldDoKicker}</p>
          <h2 id="field-checklist" className="mt-1 text-base font-semibold text-fg">
            {he.installationChecklist}
          </h2>
        </div>
        {items.length ? (
          <p className="public-mono text-xs text-fg-muted" dir="ltr">
            {done}/{items.length}
          </p>
        ) : null}
      </div>
      <ul className="field-checklist mt-3">
        {items.map((item) => (
          <li key={item.id}>
            <label className="field-check-row">
              <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={Boolean(item.completed)}
                disabled={pending || locked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
              />
              <span className={item.completed ? "text-fg-muted line-through" : "text-fg"}>{item.label_he}</span>
            </label>
          </li>
        ))}
        {!items.length ? (
          <li className="py-4 text-sm text-fg-muted">{he.installationChecklistEmpty}</li>
        ) : null}
      </ul>
    </section>
  );
}

function EquipmentSection({ items, loading }: { items: EquipmentOut[]; loading: boolean }) {
  return (
    <section className="field-section" aria-labelledby="field-equipment">
      <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldEquipmentKicker}</p>
      <h2 id="field-equipment" className="mt-1 flex items-center gap-2 text-base font-semibold text-fg">
        <Wrench className="size-4 text-fg-muted" aria-hidden />
        {he.fieldEquipmentTitle}
      </h2>
      {loading ? <p className="mt-3 text-sm text-fg-muted">{he.loading}</p> : null}
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {items.slice(0, 12).map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{row.name}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {[equipmentCategoryLabel(row.category), row.location_note, row.serial].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Status label={he.equipmentStatuses[row.status as keyof typeof he.equipmentStatuses] ?? row.status} />
          </li>
        ))}
        {!loading && !items.length ? <li className="py-4 text-sm text-fg-muted">{he.equipmentEmpty}</li> : null}
      </ul>
    </section>
  );
}

function PhotosSection({
  photos,
  canUpload,
  uploading,
  online,
  fileRef,
  onPick,
  onFile,
}: {
  photos: DocumentOut[];
  canUpload: boolean;
  uploading: boolean;
  online: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFile: (file: File) => void;
}) {
  return (
    <section className="field-section" aria-labelledby="field-photos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldPhotosKicker}</p>
          <h2 id="field-photos" className="mt-1 text-base font-semibold text-fg">
            {he.fieldPhotosTitle}
          </h2>
        </div>
        {canUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
              }}
            />
            <Button type="button" variant="secondary" loading={uploading} disabled={!online} onClick={onPick}>
              <Camera className="size-4" aria-hidden />
              {he.fieldAddPhoto}
            </Button>
          </>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {photos.slice(0, 8).map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 py-3 text-sm">
            <Camera className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="min-w-0 truncate">{doc.original_filename || doc.id}</span>
            <span className="ms-auto shrink-0 text-xs text-fg-muted">{formatDate(doc.created_at)}</span>
          </li>
        ))}
        {!photos.length ? <li className="py-4 text-sm text-fg-muted">{he.fieldPhotosEmpty}</li> : null}
      </ul>
    </section>
  );
}

function JobMetaFoot({ job }: { job: JobOut }) {
  if (!job.started_at && !job.completed_at) return null;
  return (
    <p className="public-mono text-[10px] tracking-[0.12em] text-fg-subtle" dir="ltr">
      {[
        job.started_at ? `START ${formatTime(job.started_at) || formatDate(job.started_at)}` : null,
        job.completed_at ? `DONE ${formatTime(job.completed_at) || formatDate(job.completed_at)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );
}

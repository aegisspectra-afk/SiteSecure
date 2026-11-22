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
import {
  Camera,
  ChevronLeft,
  FolderOpen,
  MapPin,
  MoreHorizontal,
  Phone,
  Wrench,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { mapsSearchUrl } from "../../lib/address";
import { planQuotaMessage } from "../../lib/plan-quota";
import { useOnlineStatus } from "../../lib/use-online-status";
import { useSession } from "../../lib/session";
import { FieldActionSheet } from "./FieldActionSheet";
import { JobAssignForm } from "../jobs/JobAssignForm";
import { formatScheduleHe } from "../../lib/job-schedule";
import { JobSignatureSection } from "../jobs/JobSignatureSection";
import { JobChecklist } from "../jobs/JobChecklist";
import { uploadJobFile } from "../../lib/job-upload";
import { isValidIsraeliMobile } from "../../lib/quote-recipient-phone";
import {
  openSharePlaceholderTab,
  resolveWhatsAppOpen,
} from "../../lib/quote-whatsapp-share";

function jobStatusLabel(status: string): string {
  return he.jobStatuses[status as keyof typeof he.jobStatuses] ?? status;
}

function jobStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "in_progress" || status === "en_route" || status === "arrived" || status === "blocked") {
    return "warning";
  }
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
  const canAssign = can(roleKey, "jobs.assign", features);

  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [handoverUrl, setHandoverUrl] = useState<string | null>(null);
  const completeKeyRef = useRef<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["job", workspaceId, jobId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getJob(workspaceId!, jobId),
  });

  const membersQuery = useQuery({
    queryKey: ["members-assign", workspaceId],
    enabled: Boolean(workspaceId && canAssign),
    queryFn: () => api.listMembers(workspaceId!),
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

  const serviceQuery = useQuery({
    queryKey: ["job-service-call", workspaceId, jobQuery.data?.service_call_id],
    enabled: Boolean(workspaceId && jobQuery.data?.service_call_id),
    queryFn: () => api.getServiceCall(workspaceId!, jobQuery.data!.service_call_id!),
  });

  const equipmentQuery = useQuery({
    queryKey: ["job-equipment", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId && canSystems),
    queryFn: () => api.listEquipment(workspaceId!, siteId!),
  });

  const docsQuery = useQuery({
    queryKey: ["job-docs", workspaceId, jobId],
    enabled: Boolean(workspaceId && canViewDocs),
    queryFn: () => api.listDocuments(workspaceId!, { entity_type: "job", entity_id: jobId, limit: 50 }),
  });

  const invalidateJob = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ["job", workspaceId, jobId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    if (siteId) void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, siteId] });
  };

  const enRoute = useMutation({
    mutationFn: () => api.enRouteJob(workspaceId!, jobId),
    onSuccess: invalidateJob,
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });
  const arrivedMut = useMutation({
    mutationFn: () => api.arrivedJob(workspaceId!, jobId),
    onSuccess: invalidateJob,
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });
  const start = useMutation({
    mutationFn: () => api.startJob(workspaceId!, jobId),
    onSuccess: invalidateJob,
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.jobLoadError),
  });

  const complete = useMutation({
    mutationFn: () => {
      if (!completeKeyRef.current) {
        completeKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? `complete-${crypto.randomUUID()}`
            : `complete-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      return api.completeJob(
        workspaceId!,
        jobId,
        { completion_notes: notes.trim() || undefined },
        { idempotencyKey: completeKeyRef.current },
      );
    },
    onSuccess: (result) => {
      setCompleting(false);
      setNotes("");
      setHandoverUrl(result.handover_url || null);
      completeKeyRef.current = null;
      invalidateJob();
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "COMPLETION_BLOCKED") {
        const missing = Array.isArray(err.details?.missing) ? (err.details.missing as string[]) : [];
        setError(missing.length ? `${he.fieldCompleteBlocked}: ${missing.join(" · ")}` : err.message);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : he.jobLoadError);
    },
  });

  // DEMO-4.3: one item update (done / N/A / notes / photo); errors show on the row.
  const patchItem = async (
    itemId: string,
    body: { completed?: boolean; not_applicable?: boolean; notes?: string | null; photo_document_id?: string | null },
  ) => {
    await api.patchJobChecklistItem(workspaceId!, jobId, itemId, body);
    await queryClient.invalidateQueries({ queryKey: ["job-checklist", workspaceId, jobId] });
  };
  const uploadItemPhoto = async (file: File) => {
    const documentId = await uploadJobFile(api, workspaceId!, jobId, file);
    void queryClient.invalidateQueries({ queryKey: ["job-docs", workspaceId, jobId] });
    return documentId;
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      await uploadJobFile(api, workspaceId!, jobId, file);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job-docs", workspaceId, jobId] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setError(planQuotaMessage(err) ?? (err instanceof Error ? err.message : he.sitesError)),
  });

  if (!workspaceId) return <ErrorState title={he.jobLoadError} />;
  if (jobQuery.isError) {
    const msg = jobQuery.error instanceof ApiClientError ? jobQuery.error.message : he.jobLoadError;
    return <ErrorState title={msg} />;
  }
  if (jobQuery.isLoading || !jobQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  const job = jobQuery.data;
  const items = checklistQuery.data ?? [];
  const equipment = equipmentQuery.data?.items ?? [];
  const photos = docsQuery.data?.items ?? [];
  // DEMO-3.1: date and time window, e.g. "ה׳ 20.11 · 08:00–10:00".
  const scheduledWindow = formatScheduleHe(job.scheduled_for, job.scheduled_end);
  const assignee = job.assignees?.[0];
  // Presentation mirrors existing client gating (server remains authoritative).
  const canEnRoute = canStart && job.status === "scheduled";
  const canArrive = canStart && job.status === "en_route";
  const canStartJob = canStart && job.status === "arrived";
  const checklistItems = checklistQuery.data ?? [];
  const checklistReady = checklistItems.every((item) => {
    if (!item.required) return true;
    return Boolean(item.completed) || Boolean(item.not_applicable);
  });
  const photosReady = checklistItems.every((item) => {
    if (!item.photo_required || item.not_applicable) return true;
    if (!item.completed) return true;
    return Boolean(item.photo_document_id);
  });
  const signatureReady = Boolean(job.customer_signature_document_id);
  const completionReady = checklistReady && photosReady && signatureReady;
  const canCompleteJob = canComplete && job.status === "in_progress";
  const jobDone = job.status === "completed";
  const mapsHref = mapsSearchUrl(siteQuery.data?.address as Record<string, unknown> | null);
  const phone = customerQuery.data?.phone ?? null;
  const techMembers = (membersQuery.data ?? []).filter(
    (m) => m.status === "active" && (m.role_key === "technician" || m.role_key === "manager"),
  );

  let primaryAction: ReactNode = null;
  if (canEnRoute) {
    primaryAction = (
      <Button type="button" loading={enRoute.isPending} disabled={!online} onClick={() => enRoute.mutate()}>
        {he.startRoute}
      </Button>
    );
  } else if (canArrive) {
    primaryAction = (
      <Button type="button" loading={arrivedMut.isPending} disabled={!online} onClick={() => arrivedMut.mutate()}>
        {he.markArrived}
      </Button>
    );
  } else if (canStartJob) {
    primaryAction = (
      <Button type="button" loading={start.isPending} disabled={!online} onClick={() => start.mutate()}>
        {he.startJob}
      </Button>
    );
  } else if (canCompleteJob && !completing) {
    primaryAction = (
      <Button type="button" data-testid="job-complete-open" disabled={!online} onClick={() => setCompleting(true)}>
        {he.completeJob}
      </Button>
    );
  }

  const quickItems: { key: string; label: string; icon: ReactNode; href?: string; onClick?: () => void; external?: boolean }[] = [];
  if (mapsHref) {
    quickItems.push({
      key: "maps",
      label: he.navigateMaps,
      icon: <MapPin className="size-4" aria-hidden />,
      href: mapsHref,
      external: true,
    });
  }
  if (phone) {
    quickItems.push({
      key: "call",
      label: he.siteFieldCall,
      icon: <Phone className="size-4" aria-hidden />,
      href: `tel:${phone}`,
    });
  }
  if (siteId) {
    quickItems.push({
      key: "site",
      label: he.fieldOpenSite,
      icon: <FolderOpen className="size-4" aria-hidden />,
      href: `/app/sites/${siteId}`,
    });
  }
  if (canUpload && !jobDone) {
    quickItems.push({
      key: "photo",
      label: he.fieldAddPhoto,
      icon: <Camera className="size-4" aria-hidden />,
      onClick: () => fileRef.current?.click(),
    });
  }

  const moreLinks: { key: string; label: string; href?: string; onClick?: () => void }[] = [];
  if (job.project_id) {
    moreLinks.push({ key: "project", label: he.openProject, href: `/app/projects/${job.project_id}` });
  }
  if (siteId && !quickItems.some((q) => q.key === "site")) {
    moreLinks.push({ key: "site", label: he.fieldOpenSite, href: `/app/sites/${siteId}` });
  }
  if (mapsHref && !quickItems.some((q) => q.key === "maps")) {
    moreLinks.push({ key: "maps", label: he.navigateMaps, href: mapsHref });
  }
  if (phone && !quickItems.some((q) => q.key === "call")) {
    moreLinks.push({ key: "call", label: he.siteFieldCall, href: `tel:${phone}` });
  }

  const showMore = moreLinks.length > 0 || Boolean(canAssign && !jobDone);

  const quickPrimary = quickItems.slice(0, 3);

  return (
    <div className="field-job">
      <div className="field-job-nav">
        <Link to="/app/today" className="field-job-back">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {he.navToday}
        </Link>
        {siteId ? (
          <Link to="/app/sites/$siteId" params={{ siteId }} className="text-sm text-fg-muted hover:text-fg">
            {he.sitesDetail}
          </Link>
        ) : null}
      </div>

      {!online ? (
        <div className="field-offline-banner" role="status">
          <p className="field-offline-title">{he.fieldOfflineTitle}</p>
          <p className="field-offline-detail">{he.fieldOfflineBody}</p>
        </div>
      ) : null}

      <div className="field-job-layout">
        <div className="field-job-main">
          <header className="field-job-object">
            <div className="field-job-object-top">
              <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.fieldJobKicker}</p>
              <Status label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
            </div>
            <p className="public-mono mt-2 text-xs text-fg-muted" dir="ltr">
              <bdi>{job.number}</bdi>
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">{job.title}</h1>
            <p className="mt-2 text-sm font-medium text-fg">{siteQuery.data?.name || he.fieldSiteUnknown}</p>
            {customerQuery.data?.display_name ? (
              <p className="mt-0.5 text-sm text-fg-muted">{customerQuery.data.display_name}</p>
            ) : null}
            <div className="field-job-object-meta">
              {scheduledWindow ? (
                <p className="text-sm text-fg" data-testid="job-schedule-window">
                  <bdi>{scheduledWindow}</bdi>
                </p>
              ) : (
                <p className="text-sm text-fg-muted">{he.fieldNoSchedule}</p>
              )}
              {job.priority ? (
                <Status
                  label={he.jobPriority[job.priority as keyof typeof he.jobPriority] ?? job.priority}
                  tone="neutral"
                />
              ) : null}
            </div>
            {job.service_call_id ? (
              <p className="mt-2 text-xs text-fg-muted">
                {he.serviceCallNumber}
                {serviceQuery.data?.number ? ` ${serviceQuery.data.number}` : ""}
                <span>{` · ${he.fieldJobNumber} ${job.number}`}</span>
              </p>
            ) : null}
          </header>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          {primaryAction && !completing ? (
            <div className="field-job-primary field-job-primary-cta" role="group" aria-label={he.fieldPrimaryAria}>
              {primaryAction}
            </div>
          ) : null}

          {(quickPrimary.length > 0 || showMore) && (
            <nav className="field-quick" aria-label={he.fieldQuickAria}>
              {quickPrimary.map((item) => {
                if (item.key === "site" && siteId) {
                  return (
                    <Link key={item.key} to="/app/sites/$siteId" params={{ siteId }} className="field-quick-tile">
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                if (item.href) {
                  return (
                    <a
                      key={item.key}
                      className="field-quick-tile"
                      href={item.href}
                      {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </a>
                  );
                }
                return (
                  <button key={item.key} type="button" className="field-quick-tile" onClick={item.onClick}>
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {showMore ? (
                <button type="button" className="field-quick-tile" onClick={() => setMoreOpen(true)}>
                  <MoreHorizontal className="size-4" aria-hidden />
                  <span>{he.fieldMore}</span>
                </button>
              ) : null}
            </nav>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />

          <JobChecklist
            api={api}
            workspaceId={workspaceId!}
            items={items}
            locked={jobDone || !canStart}
            online={online}
            onPatch={patchItem}
            onUploadPhoto={uploadItemPhoto}
          />

          <EquipmentSection items={equipment} loading={equipmentQuery.isLoading} />

          <PhotosSection
            photos={photos}
            canUpload={Boolean(canUpload && !jobDone)}
            uploading={upload.isPending}
            online={online}
            onPick={() => fileRef.current?.click()}
          />

          <JobSignatureSection
            api={api}
            workspaceId={workspaceId!}
            job={job}
            canSign={canStart}
            online={online}
            onSigned={invalidateJob}
          />

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
              {handoverUrl ? (
                <p className="mt-3 text-sm">
                  <a className="text-action underline" href={handoverUrl} target="_blank" rel="noreferrer">
                    {he.handoverOpenCertificate}
                  </a>
                </p>
              ) : null}
              <JobWhatsAppShare
                customerName={customerQuery.data?.display_name || ""}
                phone={phone}
                pageUrl={handoverUrl || (typeof window !== "undefined" ? window.location.href : "")}
              />
            </section>
          ) : null}

          <JobMetaFoot job={job} />
        </div>

        <aside className="field-job-rail" aria-label={he.fieldWorkDetails}>
          <section className="field-rail-card">
            <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldAssignKicker}</p>
            <p className="mt-1 text-sm text-fg">
              {assignee?.display_name || assignee?.user_id || he.unassignedJob}
            </p>
            {assignee?.assigned_at ? (
              <p className="mt-1 text-xs text-fg-muted">
                {he.assignedAt} {formatTime(assignee.assigned_at) || formatDate(assignee.assigned_at)}
                {assignee.assigned_by_name ? ` · ${he.assignedBy} ${assignee.assigned_by_name}` : ""}
              </p>
            ) : null}
            {canAssign && !jobDone ? (
              <JobAssignForm
                key={`rail-${job.scheduled_for ?? ""}-${job.scheduled_end ?? ""}-${assignee?.user_id ?? ""}`}
                className="mt-3"
                api={api}
                workspaceId={workspaceId!}
                job={job}
                members={techMembers}
                hasAssignee={Boolean(assignee)}
                online={online}
                onDone={invalidateJob}
              />
            ) : null}
          </section>

          <section className="field-rail-card field-rail-card-desktop-only">
            <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldWhereKicker}</p>
            <p className="mt-1 text-sm font-medium text-fg">{siteQuery.data?.name || he.fieldSiteUnknown}</p>
            {customerQuery.data?.display_name ? (
              <p className="mt-0.5 text-sm text-fg-muted">{customerQuery.data.display_name}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {mapsHref ? (
                <a className="field-chip" href={mapsHref} target="_blank" rel="noreferrer">
                  <MapPin className="size-4" aria-hidden />
                  {he.navigateMaps}
                </a>
              ) : null}
              {phone ? (
                <a className="field-chip" href={`tel:${phone}`}>
                  <Phone className="size-4" aria-hidden />
                  {he.siteFieldCall}
                </a>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <FieldActionSheet
        open={completing && canCompleteJob}
        onClose={() => setCompleting(false)}
        title={he.completeJob}
      >
        <div className="field-complete-sheet" data-testid="job-complete-sheet">
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldCompleteKicker}</p>
          <label className="field-complete-label" htmlFor="completion-notes">
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
          {!completionReady ? (
            <p className="field-complete-blocker" role="alert">
              {!signatureReady
                ? he.fieldCompleteNeedSignature
                : !checklistReady
                  ? he.fieldCompleteNeedChecklist
                  : he.fieldCompleteNeedPhotos}
            </p>
          ) : null}
          <div className="field-complete-actions">
            <Button
              type="button"
              data-testid="job-complete-submit"
              loading={complete.isPending}
              disabled={!online || !completionReady || complete.isPending}
              onClick={() => complete.mutate()}
            >
              {he.fieldConfirmComplete}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCompleting(false)}>
              {he.cancel}
            </Button>
          </div>
        </div>
      </FieldActionSheet>

      <FieldActionSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={he.fieldMoreTitle}>
        <ul className="field-sheet-list">
          {moreLinks.map((link) => (
            <li key={link.key}>
              {link.href ? (
                <a
                  className="field-sheet-row"
                  href={link.href}
                  data-autofocus={link.key === moreLinks[0]?.key ? true : undefined}
                  onClick={() => setMoreOpen(false)}
                  {...(link.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {link.label}
                </a>
              ) : (
                <button type="button" className="field-sheet-row" onClick={link.onClick}>
                  {link.label}
                </button>
              )}
            </li>
          ))}
          {canAssign && !jobDone ? (
            <li className="field-sheet-assign">
              <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldAssignKicker}</p>
              <JobAssignForm
                key={`sheet-${job.scheduled_for ?? ""}-${job.scheduled_end ?? ""}-${assignee?.user_id ?? ""}`}
                className="mt-2"
                api={api}
                workspaceId={workspaceId!}
                job={job}
                members={techMembers}
                hasAssignee={Boolean(assignee)}
                online={online}
                onDone={() => {
                  invalidateJob();
                  setMoreOpen(false);
                }}
              />
            </li>
          ) : null}
        </ul>
      </FieldActionSheet>
    </div>
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
      <ul className="field-row-list mt-2">
        {items.slice(0, 12).map((row) => (
          <li key={row.id} className="field-info-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{row.name}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {[equipmentCategoryLabel(row.category), row.location_note, row.serial].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Status label={he.equipmentStatuses[row.status as keyof typeof he.equipmentStatuses] ?? row.status} />
          </li>
        ))}
        {!loading && !items.length ? <li className="field-row-empty">{he.equipmentEmpty}</li> : null}
      </ul>
    </section>
  );
}

function PhotosSection({
  photos,
  canUpload,
  uploading,
  online,
  onPick,
}: {
  photos: DocumentOut[];
  canUpload: boolean;
  uploading: boolean;
  online: boolean;
  onPick: () => void;
}) {
  return (
    <section className="field-section" aria-labelledby="field-photos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.fieldEvidence}</p>
          <h2 id="field-photos" className="mt-1 text-base font-semibold text-fg">
            {he.fieldPhotosTitle}
          </h2>
        </div>
        {canUpload ? (
          <Button type="button" variant="secondary" loading={uploading} disabled={!online} onClick={onPick}>
            <Camera className="size-4" aria-hidden />
            {he.fieldAddPhoto}
          </Button>
        ) : null}
      </div>
      <ul className="field-row-list mt-2">
        {photos.slice(0, 8).map((doc) => (
          <li key={doc.id} className="field-info-row">
            <Camera className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">{doc.original_filename || doc.id}</span>
            <span className="shrink-0 text-xs text-fg-muted">{formatDate(doc.created_at)}</span>
          </li>
        ))}
        {!photos.length ? <li className="field-row-empty">{he.fieldPhotosEmpty}</li> : null}
      </ul>
    </section>
  );
}

function JobWhatsAppShare({
  customerName,
  phone,
  pageUrl,
}: {
  customerName: string;
  phone: string | null;
  pageUrl: string;
}) {
  const mobileOk = isValidIsraeliMobile(phone);
  return (
    <div className="mt-3 flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        data-testid="job-whatsapp-share"
        disabled={!mobileOk || !pageUrl}
        title={!mobileOk ? he.jobWhatsAppDisabledHint : undefined}
        onClick={() => {
          if (!mobileOk || !pageUrl) return;
          const placeholder = openSharePlaceholderTab();
          resolveWhatsAppOpen(
            {
              customerName,
              publicUrl: pageUrl,
              phoneDigits: phone || "",
              message: he.jobWhatsAppMessage(customerName, pageUrl),
            },
            placeholder,
          );
        }}
      >
        {he.jobWhatsApp}
      </Button>
      {!mobileOk ? <p className="text-xs text-fg-muted">{he.jobWhatsAppDisabledHint}</p> : null}
    </div>
  );
}

function JobMetaFoot({ job }: { job: JobOut }) {
  if (!job.started_at && !job.completed_at) return null;
  return (
    <p className="text-xs text-fg-subtle" data-testid="job-meta-foot">
      {[
        job.started_at ? he.fieldStartedAt(formatTime(job.started_at) || formatDate(job.started_at) || "") : null,
        job.completed_at ? he.fieldDoneAt(formatTime(job.completed_at) || formatDate(job.completed_at) || "") : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );
}

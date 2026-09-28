import { ApiClientError, type WarrantyOut } from "@site-secure/api-client";
import { Button, Status } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { WarrantyStudio } from "../../../components/warranties/WarrantyStudio";
import { ErrorState, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";
import {
  daysRemaining,
  effectiveWarrantyStatus,
  expiryAttention,
  formatDisplayDate,
  readWarrantyPolicy,
  warrantyDocumentText,
  warrantyKindLabel,
} from "../../../lib/warranty-document";
import { filterWarrantiesLocal, warrantyStatusLabel, warrantyStatusTone } from "../../../lib/warranties";

export const Route = createFileRoute("/app/warranties/")({
  validateSearch: (search: Record<string, unknown>) => ({
    customer: typeof search.customer === "string" ? search.customer : "",
    edit: typeof search.edit === "string" ? search.edit : "",
  }),
  component: WarrantiesPage,
});

function WarrantiesPage() {
  return (
    <RequirePermission permission="warranties.view">
      <WarrantiesBody />
    </RequirePermission>
  );
}

function WarrantiesBody() {
  const search = Route.useSearch();
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canIssue = can(roleKey, "warranties.issue", features);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [studioOpen, setStudioOpen] = useState(Boolean(search.customer) && !search.edit);
  const [studioMode, setStudioMode] = useState<"create" | "edit" | "duplicate">("create");
  const [studioSource, setStudioSource] = useState<WarrantyOut | null>(null);
  const [presetCustomerId, setPresetCustomerId] = useState(search.customer);

  const listQuery = useQuery({
    queryKey: ["warranties", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWarranties(workspaceId!, { limit: 100 }),
  });

  const cancel = useMutation({
    mutationFn: (row: WarrantyOut) => api.patchWarranty(workspaceId!, row.id, { status: "cancelled" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["warranties", workspaceId] });
    },
  });

  const rows = listQuery.data?.items ?? [];
  const visible = useMemo(() => {
    return filterWarrantiesLocal(rows, query).filter((row) => {
      const current = effectiveWarrantyStatus(row);
      if (status && current !== status) return false;
      const created = row.created_at.slice(0, 10);
      if (createdFrom && created < createdFrom) return false;
      if (createdTo && created > createdTo) return false;
      return true;
    });
  }, [rows, query, status, createdFrom, createdTo]);

  const metrics = useMemo(() => {
    const count = (key: string) => rows.filter((row) => effectiveWarrantyStatus(row) === key).length;
    return {
      active: count("active"),
      expiring: count("expiring_soon"),
      expired: count("expired"),
      draft: count("draft"),
    };
  }, [rows]);

  const expiring = rows.filter((row) => effectiveWarrantyStatus(row) === "expiring_soon");
  const openedEdit = useRef("");

  useEffect(() => {
    if (!search.edit || openedEdit.current === search.edit) return;
    const row = rows.find((item) => item.id === search.edit);
    if (!row) return;
    openedEdit.current = search.edit;
    setStudioMode("edit");
    setStudioSource(row);
    setPresetCustomerId("");
    setStudioOpen(true);
  }, [rows, search.edit]);

  function openCreate() {
    setStudioMode("create");
    setStudioSource(null);
    setPresetCustomerId(search.customer);
    setStudioOpen(true);
  }

  function openRow(row: WarrantyOut, mode: "edit" | "duplicate") {
    setStudioMode(mode);
    setStudioSource(row);
    setPresetCustomerId("");
    setStudioOpen(true);
  }

  async function markSent(row: WarrantyOut) {
    const policy = readWarrantyPolicy(row.policy);
    if (!policy || !workspaceId) return;
    await api.patchWarranty(workspaceId, row.id, {
      policy: { ...policy, sent_at: new Date().toISOString() } as unknown as Record<string, unknown>,
    });
    await refresh();
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["warranties", workspaceId] });
    await queryClient.invalidateQueries({ queryKey: ["customer-warranties"] });
  }

  if (!workspaceId) return <ErrorState title={he.warrantiesError} />;

  return (
    <ModuleScaffold
      title={he.warrantiesTitle}
      lead={he.warrantiesLead}
      action={
        canIssue ? (
          <Button type="button" onClick={openCreate}>
            + יצירת אחריות חדשה
          </Button>
        ) : null
      }
    >
      <div className="warranty-metrics">
        <Metric label="פעילות" value={metrics.active} />
        <Metric label="עומדות להסתיים" value={metrics.expiring} />
        <Metric label="הסתיימו" value={metrics.expired} />
        <Metric label="טיוטות" value={metrics.draft} />
      </div>

      {expiring.length > 0 ? (
        <section className="warranty-alert">
          <p>אחריות שעומדת להסתיים</p>
          <ul>
            {expiring.slice(0, 4).map((row) => {
              const left = daysRemaining(row.ends_on);
              const bucket = expiryAttention(row.ends_on);
              return (
                <li key={row.id}>
                  {row.number} · {row.customer_name || "לקוח"} · {row.title || "ללא נושא"} · בעוד {Math.max(left, 0)} ימים
                  {bucket ? ` · התראה ${bucket} ימים` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="warranty-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לקוח, מספר, מוצר או מספר סידורי" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">כל הסטטוסים</option>
          <option value="active">פעילה</option>
          <option value="expiring_soon">עומדת להסתיים</option>
          <option value="expired">הסתיימה</option>
          <option value="draft">טיוטה</option>
          <option value="cancelled">בוטלה</option>
        </select>
        <label>
          נוצרה מ־
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
        </label>
        <label>
          עד
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
        </label>
      </div>

      {listQuery.isError ? (
        <ErrorState
          title={he.warrantiesError}
          action={
            <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : listQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.warrantiesEmpty}</p>
      ) : (
        <div className="warranty-board">
          {visible.map((row) => (
            <WarrantyCard
              key={row.id}
              row={row}
              canIssue={canIssue}
              workspaceName={membership?.workspace_name ?? ""}
              onEdit={() => openRow(row, "edit")}
              onDuplicate={() => openRow(row, "duplicate")}
              onCancel={() => cancel.mutate(row)}
              onSend={() => void markSent(row)}
              cancelling={cancel.isPending}
            />
          ))}
        </div>
      )}

      <WarrantyStudio
        open={studioOpen}
        mode={studioMode}
        source={studioSource}
        presetCustomerId={presetCustomerId}
        onClose={() => setStudioOpen(false)}
        onSaved={() => void refresh()}
      />
      {cancel.isError ? (
        <p className="warranty-error">{cancel.error instanceof ApiClientError ? cancel.error.message : he.warrantiesError}</p>
      ) : null}
    </ModuleScaffold>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="warranty-metric">
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}

function WarrantyCard({
  row,
  canIssue,
  workspaceName,
  onEdit,
  onDuplicate,
  onCancel,
  onSend,
  cancelling,
}: {
  row: WarrantyOut;
  canIssue: boolean;
  workspaceName: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onSend: () => void;
  cancelling: boolean;
}) {
  const status = effectiveWarrantyStatus(row);
  const policy = readWarrantyPolicy(row.policy);
  const subject = policy?.subject_label || row.title || row.equipment_name || "—";
  const kind = policy ? warrantyKindLabel(policy.warranty_kind) : row.type;
  const left = daysRemaining(row.ends_on);

  async function share() {
    const text = policy?.sections.length
      ? warrantyDocumentText(policy.sections, row.number)
      : `${row.number}\n${subject}\n${row.starts_on} – ${row.ends_on}`;
    const payload = { title: `${workspaceName} · ${row.number}`, text };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* user dismissed or share failed */
      }
    }
    await navigator.clipboard.writeText(text);
  }

  function send() {
    const text = policy?.sections.length
      ? warrantyDocumentText(policy.sections, row.number)
      : `${row.number} · ${subject}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`אחריות ${row.number}`)}&body=${encodeURIComponent(text)}`;
  }

  return (
    <article className="warranty-card">
      <header>
        <div>
          <p className="warranty-card-number">{row.number}</p>
          <h3>{row.customer_name || "לקוח"}</h3>
          <p>{subject}</p>
        </div>
        <Status label={warrantyStatusLabel(status)} tone={warrantyStatusTone(status)} />
      </header>
      <dl>
        <div>
          <dt>סוג</dt>
          <dd>{kind}</dd>
        </div>
        <div>
          <dt>התחלה</dt>
          <dd>{formatDisplayDate(row.starts_on)}</dd>
        </div>
        <div>
          <dt>סיום</dt>
          <dd>{formatDisplayDate(row.ends_on)}</dd>
        </div>
        <div>
          <dt>נותרו</dt>
          <dd>{status === "expired" || status === "cancelled" ? "—" : `${Math.max(left, 0)} ימים`}</dd>
        </div>
        <div>
          <dt>נוצרה</dt>
          <dd>{formatDisplayDate(row.created_at.slice(0, 10))}</dd>
        </div>
      </dl>
      <div className="warranty-card-actions">
        <Link to="/app/warranties/$warrantyId" params={{ warrantyId: row.id }}>צפייה</Link>
        {canIssue ? <button type="button" onClick={onEdit}>עריכה</button> : null}
        {canIssue ? <button type="button" onClick={onDuplicate}>שכפול</button> : null}
        <Link to="/app/warranties/$warrantyId" params={{ warrantyId: row.id }}>הורדת PDF</Link>
        <button type="button" onClick={() => void share()}>שיתוף</button>
        <button type="button" onClick={() => { onSend(); send(); }}>שליחה ללקוח</button>
        {canIssue && status !== "cancelled" ? (
          <button type="button" disabled={cancelling} onClick={onCancel}>ביטול אחריות</button>
        ) : null}
      </div>
    </article>
  );
}

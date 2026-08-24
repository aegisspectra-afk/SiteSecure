import { PageHeader, Select, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedback,
});

const STATUSES = ["new", "triage", "in_progress", "resolved", "wont_fix"] as const;

function AdminFeedback() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["admin-feedback", status],
    queryFn: () => api.adminFeedback(status ? { status } : {}),
  });
  const patch = useMutation({
    mutationFn: (input: { id: string; status?: string; internal_notes?: string }) =>
      api.adminPatchFeedback(input.id, { status: input.status, internal_notes: input.internal_notes }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-feedback"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminFeedback} />
      <Select id="admin-fb-status" label={he.adminStatus} value={status} onChange={(ev) => setStatus(ev.target.value)}>
        <option value="">הכול</option>
        {STATUSES.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </Select>
      <ul className="flex flex-col gap-3">
        {(query.data ?? []).map((row) => (
          <li key={row.id} className="ops-card px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-fg">{row.title}</p>
              <p className="ltr-meta text-xs text-fg-muted">{row.ticket_id}</p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{row.body}</p>
            <p className="ltr-meta mt-2 text-xs text-fg-subtle">
              {row.report_type} · {row.severity} · {row.page_url ?? ""}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select
                id={`st-${row.id}`}
                label={he.adminStatus}
                value={row.status}
                onChange={(ev) => patch.mutate({ id: row.id, status: ev.target.value })}
              >
                {STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </Select>
              <Textarea
                id={`note-${row.id}`}
                label={he.adminNotes}
                defaultValue={row.internal_notes ?? ""}
                rows={2}
                onBlur={(ev) => {
                  const notes = ev.target.value.trim();
                  if (notes !== (row.internal_notes ?? "").trim()) {
                    patch.mutate({ id: row.id, internal_notes: notes });
                  }
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

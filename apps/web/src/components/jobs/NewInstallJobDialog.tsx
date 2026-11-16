import { ApiClientError, type ApiClient, type JobOut } from "@site-secure/api-client";
import { Button, Modal } from "@site-secure/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { emptySchedule, scheduleToApi, type ScheduleInputs } from "../../lib/job-schedule";
import { JobScheduleFields } from "./JobScheduleFields";

/**
 * DEMO-3.1: creating an installation job asks for the visit time and, when allowed, the
 * technician, so the job is born scheduled and assigned.
 */
export function NewInstallJobDialog({
  open,
  onClose,
  api,
  workspaceId,
  canAssign,
  job,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  api: ApiClient;
  workspaceId: string;
  canAssign: boolean;
  job: { title: string; customer_id: string; site_id: string; project_id: string };
  onCreated: (job: JobOut) => void;
}) {
  const [schedule, setSchedule] = useState<ScheduleInputs>(emptySchedule());
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["members-assign", workspaceId],
    enabled: Boolean(open && workspaceId && canAssign),
    queryFn: () => api.listMembers(workspaceId),
  });
  const techMembers = (membersQuery.data ?? []).filter(
    (m) => m.status === "active" && (m.role_key === "technician" || m.role_key === "manager"),
  );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = scheduleToApi(schedule);
      if (!parsed.ok) throw new Error(parsed.error);
      const created = await api.createJob(workspaceId, { ...job, kind: "installation", ...(parsed.value ?? {}) });
      if (userId) await api.assignJob(workspaceId, created.id, { user_id: userId });
      return created;
    },
    onSuccess: (created) => {
      setError(null);
      onCreated(created);
    },
    onError: (err) => setError(err instanceof ApiClientError || err instanceof Error ? err.message : he.jobLoadError),
  });

  return (
    <Modal open={open} onClose={onClose} title={he.jobNewInstallTitle}>
      <div className="flex flex-col gap-4" data-testid="new-install-job">
        <p className="text-sm text-fg">{job.title}</p>
        <JobScheduleFields value={schedule} onChange={setSchedule} disabled={create.isPending} />
        {canAssign ? (
          <label className="text-xs font-medium text-fg-muted">
            {he.jobNewInstallTechOptional}
            <select
              className="field-control mt-1 w-full"
              data-testid="new-install-job-user"
              value={userId}
              disabled={create.isPending}
              onChange={(ev) => setUserId(ev.target.value)}
            >
              <option value="">{he.jobNewInstallNoTech}</option>
              {techMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || m.user_id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
            {he.cancel}
          </Button>
          <Button
            type="button"
            data-testid="new-install-job-submit"
            disabled={create.isPending}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {he.jobNewInstallCreate}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { ApiClientError, type ApiClient, type JobOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { sameSchedule, scheduleFromJob, scheduleToApi, type ScheduleInputs } from "../../lib/job-schedule";
import { JobScheduleFields } from "./JobScheduleFields";

type Member = { user_id: string; full_name?: string | null; email?: string | null };

/**
 * DEMO-3.1: "שבץ טכנאי" with the visit time in one step. Without a technician change the
 * same form updates only the time ("עדכון מועד").
 */
export function JobAssignForm({
  api,
  workspaceId,
  job,
  members,
  hasAssignee,
  online,
  onDone,
  className = "",
}: {
  api: ApiClient;
  workspaceId: string;
  job: Pick<JobOut, "id" | "scheduled_for" | "scheduled_end">;
  members: Member[];
  hasAssignee: boolean;
  online: boolean;
  onDone: () => void;
  className?: string;
}) {
  const initial = scheduleFromJob(job);
  const [userId, setUserId] = useState("");
  const [schedule, setSchedule] = useState<ScheduleInputs>(initial);
  const [error, setError] = useState<string | null>(null);

  const [warrantyHint, setWarrantyHint] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = scheduleToApi(schedule);
      if (!parsed.ok) throw new Error(parsed.error);
      if (userId) {
        return api.assignJob(workspaceId, job.id, { user_id: userId, ...(parsed.value ?? {}) });
      }
      if (!parsed.value) throw new Error(he.jobScheduleNeedsDate);
      return api.patchJob(workspaceId, job.id, parsed.value);
    },
    onSuccess: (result) => {
      setUserId("");
      setError(null);
      const warning =
        result && typeof result === "object" && "warranty_months_warning" in result
          ? (result as { warranty_months_warning?: string | null }).warranty_months_warning
          : null;
      setWarrantyHint(warning || null);
      onDone();
    },
    onError: (err) => setError(err instanceof ApiClientError || err instanceof Error ? err.message : he.jobLoadError),
  });

  const scheduleChanged = !sameSchedule(schedule, initial);
  const label = userId ? (hasAssignee ? he.reassignTechnician : he.assignTechnician) : he.jobScheduleUpdate;

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="job-assign-form">
      <label className="text-xs font-medium text-fg-muted">
        {hasAssignee ? he.reassignTechnician : he.assignTechnician}
        <select
          className="field-control mt-1 w-full"
          value={userId}
          data-testid="job-assign-user"
          onChange={(ev) => setUserId(ev.target.value)}
        >
          <option value="">{hasAssignee ? he.jobKeepTechnician : he.assignTechnician}</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || m.user_id}
            </option>
          ))}
        </select>
      </label>
      <JobScheduleFields value={schedule} onChange={setSchedule} disabled={save.isPending} error={error} />
      {warrantyHint ? <p className="text-xs text-warning">{warrantyHint}</p> : null}
      <Button
        type="button"
        variant="secondary"
        data-testid="job-assign-submit"
        disabled={(!userId && !scheduleChanged) || !online || save.isPending}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        {label}
      </Button>
    </div>
  );
}

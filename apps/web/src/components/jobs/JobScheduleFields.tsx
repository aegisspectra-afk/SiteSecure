import { useId } from "react";
import { DURATION_OPTIONS, type ScheduleInputs } from "../../lib/job-schedule";

/** DEMO-3.1: date, time and duration for a job visit. */
export function JobScheduleFields({
  value,
  onChange,
  disabled = false,
  error = null,
}: {
  value: ScheduleInputs;
  onChange: (next: ScheduleInputs) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const durations = DURATION_OPTIONS.some((o) => o.minutes === Number(value.minutes))
    ? DURATION_OPTIONS
    : [...DURATION_OPTIONS, { minutes: Number(value.minutes), labelHe: `${value.minutes} דקות` }];
  return (
    <fieldset className="job-schedule-fields grid gap-2" data-testid="job-schedule-fields" disabled={disabled}>
      <legend className="text-xs font-medium text-fg-muted">מועד העבודה</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-fg-muted" htmlFor={`${id}-date`}>
          תאריך
          <input
            id={`${id}-date`}
            type="date"
            className="field-control mt-1 w-full"
            data-testid="job-schedule-date"
            value={value.date}
            onChange={(ev) => onChange({ ...value, date: ev.target.value })}
          />
        </label>
        <label className="text-xs text-fg-muted" htmlFor={`${id}-time`}>
          שעה
          <input
            id={`${id}-time`}
            type="time"
            step={900}
            className="field-control mt-1 w-full"
            data-testid="job-schedule-time"
            value={value.time}
            onChange={(ev) => onChange({ ...value, time: ev.target.value })}
          />
        </label>
      </div>
      <label className="text-xs text-fg-muted" htmlFor={`${id}-dur`}>
        משך
        <select
          id={`${id}-dur`}
          className="field-control mt-1 w-full"
          data-testid="job-schedule-duration"
          value={value.minutes}
          onChange={(ev) => onChange({ ...value, minutes: Number(ev.target.value) })}
        >
          {durations.map((o) => (
            <option key={o.minutes} value={o.minutes}>
              {o.labelHe}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-xs text-danger" role="alert" data-testid="job-schedule-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

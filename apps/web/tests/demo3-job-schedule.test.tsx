import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ApiClient } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { JobAssignForm } from "../src/components/jobs/JobAssignForm";
import { he } from "../src/i18n/he";
import { scheduleFromJob, scheduleToApi } from "../src/lib/job-schedule";

describe("DEMO-3.1 schedule fields <-> API", () => {
  it("date + time + duration become scheduled_for / scheduled_end and back", () => {
    const parsed = scheduleToApi({ date: "2026-11-20", time: "08:00", minutes: 210 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value) return;
    const start = new Date(parsed.value.scheduled_for);
    const end = new Date(parsed.value.scheduled_end);
    expect((end.getTime() - start.getTime()) / 60000).toBe(210);
    expect(scheduleFromJob(parsed.value)).toEqual({ date: "2026-11-20", time: "08:00", minutes: 210 });
  });

  it("empty means no schedule; a date needs a time; duration is bounded", () => {
    expect(scheduleToApi({ date: "", time: "", minutes: 120 })).toEqual({ ok: true, value: null });
    expect(scheduleToApi({ date: "2026-11-20", time: "", minutes: 120 }).ok).toBe(false);
    expect(scheduleToApi({ date: "", time: "08:00", minutes: 120 }).ok).toBe(false);
    expect(scheduleToApi({ date: "2026-11-20", time: "08:00", minutes: 0 }).ok).toBe(false);
    expect(scheduleToApi({ date: "2026-11-20", time: "08:00", minutes: 2000 }).ok).toBe(false);
  });
});

function renderForm(api: Partial<ApiClient>, job = { id: "j1", scheduled_for: null, scheduled_end: null }, hasAssignee = false) {
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobAssignForm
        api={api as ApiClient}
        workspaceId="ws"
        job={job}
        members={[{ user_id: "u-tech", full_name: "טכנאי דמו" }]}
        hasAssignee={hasAssignee}
        online
        onDone={onDone}
      />
    </QueryClientProvider>,
  );
  return onDone;
}

describe("DEMO-3.1 'שבץ טכנאי' includes the time", () => {
  it("assigns the technician and the visit time in one call", async () => {
    const assignJob = vi.fn(async () => ({}));
    const onDone = renderForm({ assignJob } as never);
    fireEvent.change(screen.getByTestId("job-assign-user"), { target: { value: "u-tech" } });
    fireEvent.change(screen.getByTestId("job-schedule-date"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByTestId("job-schedule-time"), { target: { value: "09:30" } });
    fireEvent.change(screen.getByTestId("job-schedule-duration"), { target: { value: "120" } });
    expect(screen.getByTestId("job-assign-submit")).toHaveTextContent(he.assignTechnician);
    fireEvent.click(screen.getByTestId("job-assign-submit"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const body = (assignJob.mock.calls[0] as unknown as [string, string, Record<string, string>])[2];
    expect(body.user_id).toBe("u-tech");
    expect((new Date(body.scheduled_end!).getTime() - new Date(body.scheduled_for!).getTime()) / 60000).toBe(120);
  });

  it("without a technician change it updates only the time", async () => {
    const patchJob = vi.fn(async () => ({}));
    const assignJob = vi.fn();
    const onDone = renderForm({ patchJob, assignJob } as never, { id: "j1", scheduled_for: null, scheduled_end: null }, true);
    expect(screen.getByTestId("job-assign-submit")).toBeDisabled();
    fireEvent.change(screen.getByTestId("job-schedule-date"), { target: { value: "2026-11-21" } });
    fireEvent.change(screen.getByTestId("job-schedule-time"), { target: { value: "13:00" } });
    expect(screen.getByTestId("job-assign-submit")).toHaveTextContent(he.jobScheduleUpdate);
    fireEvent.click(screen.getByTestId("job-assign-submit"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(assignJob).not.toHaveBeenCalled();
    expect(patchJob).toHaveBeenCalledTimes(1);
  });

  it("shows a Hebrew error for a date without a time", async () => {
    const assignJob = vi.fn();
    renderForm({ assignJob } as never);
    fireEvent.change(screen.getByTestId("job-assign-user"), { target: { value: "u-tech" } });
    fireEvent.change(screen.getByTestId("job-schedule-date"), { target: { value: "2026-11-20" } });
    fireEvent.click(screen.getByTestId("job-assign-submit"));
    await waitFor(() => expect(screen.getByTestId("job-schedule-error")).toHaveTextContent("יש לבחור שעה"));
    expect(assignJob).not.toHaveBeenCalled();
  });
});

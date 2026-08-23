import { ApiClientError, type ApiClient, type LeadOut } from "@site-secure/api-client";
import { Button, Input, Select } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";
import { he } from "../../i18n/he";
import {
  visitTimeWindowLabel,
  type VisitTimeWindow,
} from "../../lib/leads";

/** Midnight UTC on a date string = date marker only (no invented clock time). */
export function visitDateMarkerIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}

export function resolveVisitSchedule(opts: {
  visitDate: string;
  visitTime: string;
  timeWindow: VisitTimeWindow | "";
}): {
  dueAt?: string;
  visitStatus: "pending_schedule" | "scheduled";
  leadStatus: "visit_scheduling" | "visit_scheduled";
  nextAction?: string;
} {
  const date = opts.visitDate.trim();
  const time = opts.visitTime.trim();
  const window = opts.timeWindow;

  if (date && time) {
    return {
      dueAt: new Date(`${date}T${time}`).toISOString(),
      visitStatus: "scheduled",
      leadStatus: "visit_scheduled",
      nextAction: he.leadActivityVisitScheduled(`${date} ${time}`),
    };
  }

  // Date + window window without exact time — do NOT invent noon.
  if (date && window) {
    const label = `${date} · ${visitTimeWindowLabel(window)}`;
    return {
      dueAt: visitDateMarkerIso(date),
      visitStatus: "scheduled",
      leadStatus: "visit_scheduled",
      nextAction: he.leadActivityVisitScheduled(label),
    };
  }

  if (date) {
    return {
      dueAt: visitDateMarkerIso(date),
      visitStatus: "pending_schedule",
      leadStatus: "visit_scheduling",
      nextAction: he.leadActivityVisitScheduled(date),
    };
  }

  return {
    visitStatus: "pending_schedule",
    leadStatus: "visit_scheduling",
  };
}

export function ScheduleVisitSheet({
  open,
  onClose,
  workspaceId,
  api,
  lead,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  api: ApiClient;
  lead: LeadOut;
  onUpdated: () => void;
}) {
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [timeWindow, setTimeWindow] = useState<VisitTimeWindow | "">("afternoon");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const schedule = useMutation({
    mutationFn: async () => {
      const resolved = resolveVisitSchedule({ visitDate, visitTime, timeWindow });

      await api.createTask(workspaceId, {
        title: `${he.leadsVisitTitle} · ${lead.title}`,
        type: "visit",
        lead_id: lead.id,
        customer_id: lead.customer_id ?? undefined,
        site_id: lead.site_id ?? undefined,
        due_at: resolved.dueAt,
        time_window: timeWindow || undefined,
        visit_status: resolved.visitStatus,
        notes: notes.trim() || undefined,
      });

      await api.patchLead(workspaceId, lead.id, {
        status: resolved.leadStatus,
        next_action: resolved.nextAction ?? lead.next_action ?? undefined,
        next_action_at: resolved.dueAt,
      });
    },
    onSuccess: () => {
      setFormError(null);
      onUpdated();
      onClose();
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.leadsError),
  });

  return (
    <QuoteFlowSheet
      open={open}
      onClose={() => {
        if (schedule.isPending) return;
        onClose();
      }}
      title={he.leadsScheduleVisit}
      subtitle={lead.title}
      variant="sheet"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={schedule.isPending} onClick={onClose}>
            {he.cancel}
          </Button>
          <Button type="button" loading={schedule.isPending} onClick={() => schedule.mutate()}>
            {he.leadsVisitSchedule}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Input id="visit-date" label={he.leadsVisitDate} type="date" value={visitDate} onChange={(ev) => setVisitDate(ev.target.value)} data-autofocus />
        <Input id="visit-time" label={he.leadsVisitTime} type="time" value={visitTime} onChange={(ev) => setVisitTime(ev.target.value)} hint={he.leadVisitTimeNotSet} />
        <Select id="visit-window" label={he.leadsVisitTimeWindow} value={timeWindow} onChange={(ev) => setTimeWindow(ev.target.value as VisitTimeWindow | "")}>
          <option value="">{he.leadVisitTimeNotSet}</option>
          <option value="morning">{he.leadVisitTimeWindows.morning}</option>
          <option value="afternoon">{he.leadVisitTimeWindows.afternoon}</option>
          <option value="evening">{he.leadVisitTimeWindows.evening}</option>
        </Select>
        <Input id="visit-notes" label={he.leadsVisitNotes} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>
    </QuoteFlowSheet>
  );
}

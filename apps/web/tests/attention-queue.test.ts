import { describe, expect, it } from "vitest";
import type { AttentionGroup } from "@site-secure/api-client";
import {
  attentionActionLabel,
  attentionEntityCount,
  attentionQueue,
  attentionQueueLimited,
  filterLeadAttention,
  meaningfulChangePercent,
} from "../src/lib/attention-queue";
import { he } from "../src/i18n/he";

const baseItem = {
  entity_type: "quote",
  entity_id: "q1",
  number: "Q-00024",
  title_he: "ממתין",
  customer_name: "לקוח",
  site_name: null,
  scheduled_for: null,
  severity: "next" as const,
  actions: [] as string[],
  updated_at: "2026-09-01T00:00:00Z",
};

describe("attentionQueue dedupe", () => {
  it("shows one row when the same quote is viewed and expiring", () => {
    const groups: AttentionGroup[] = [
      {
        kind: "quote_awaiting_us",
        label_he: "viewed",
        count: 1,
        items: [{ ...baseItem, title_he: "נצפתה", severity: "now" }],
      },
      {
        kind: "quote_expiring",
        label_he: "expiring",
        count: 1,
        items: [{ ...baseItem, title_he: "פג תוקף בקרוב", severity: "now" }],
      },
    ];
    const rows = attentionQueue(groups);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("quote_awaiting_us");
    expect(rows[0].secondarySignals).toContain(he.commandExpiringWhy);
    expect(attentionEntityCount(groups)).toBe(1);
  });

  it("prefers approved-pending-project over other quote signals", () => {
    const groups: AttentionGroup[] = [
      {
        kind: "quote_expiring",
        label_he: "e",
        count: 1,
        items: [{ ...baseItem, severity: "now" }],
      },
      {
        kind: "quote_approved_pending_project",
        label_he: "p",
        count: 1,
        items: [
          {
            ...baseItem,
            title_he: "אושרה",
            severity: "now",
            actions: ["create_project"],
          },
        ],
      },
    ];
    const rows = attentionQueue(groups, { canCreateProject: true });
    expect(rows[0].kind).toBe("quote_approved_pending_project");
    expect(rows[0].actionLabel).toBe(he.nextActionCreateProject);
  });

  it("surfaces expiring_soon action as secondary without duplicate groups", () => {
    const groups: AttentionGroup[] = [
      {
        kind: "quote_awaiting_customer",
        label_he: "sent",
        count: 1,
        items: [{ ...baseItem, actions: ["expiring_soon"], severity: "next" }],
      },
    ];
    const rows = attentionQueue(groups);
    expect(rows).toHaveLength(1);
    expect(rows[0].secondarySignals).toContain(he.commandExpiringWhy);
  });

  it("limits display while reporting total", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      ...baseItem,
      entity_id: `q${i}`,
      number: `Q-${i}`,
    }));
    const groups: AttentionGroup[] = [
      { kind: "quote_awaiting_customer", label_he: "x", count: 7, items },
    ];
    const limited = attentionQueueLimited(groups, { limit: 5 });
    expect(limited.items).toHaveLength(5);
    expect(limited.total).toBe(7);
    expect(limited.hasMore).toBe(true);
  });
});

describe("attentionActionLabel", () => {
  it("uses create project CTA for approved quotes", () => {
    expect(
      attentionActionLabel("quote_approved_pending_project", {
        ...baseItem,
        actions: ["create_project"],
      }),
    ).toBe(he.nextActionCreateProject);
  });
});

describe("filterLeadAttention", () => {
  it("keeps only early-stage leads with a next action", () => {
    const rows = filterLeadAttention([
      {
        id: "1",
        status: "new",
        next_action: "להתקשר",
      } as never,
      {
        id: "2",
        status: "quote_preparing",
        next_action: "להכין הצעה",
      } as never,
      {
        id: "3",
        status: "contacted",
        next_action: "",
      } as never,
    ]);
    expect(rows.map((r) => r.id)).toEqual(["1"]);
  });
});

describe("meaningfulChangePercent", () => {
  it("hides -100% when previous period has no volume", () => {
    expect(meaningfulChangePercent(-100, [0, 0, 0, 100, 50, 20])).toBeNull();
    expect(meaningfulChangePercent(25, [100, 100, 100, 120, 130, 140])).toBe(25);
  });
});

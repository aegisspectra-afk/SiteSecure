import { describe, expect, it } from "vitest";
import {
  classifyInviteEmail,
  filterPendingInvites,
  groupActivityItems,
  groupAttentionItems,
  mapSystemTone,
  withinWindow,
} from "./admin-ops-center";

describe("admin-ops-center", () => {
  it("classifies suspected QA emails honestly without claiming certainty", () => {
    expect(classifyInviteEmail("qa_probe+1@sitesecure.test")).toBe("suspected_qa");
    expect(classifyInviteEmail("owner@acme.co.il")).toBe("unclassified");
    expect(classifyInviteEmail("")).toBe("unclassified");
  });

  it("groups attention items by kind+severity", () => {
    const grouped = groupAttentionItems([
      {
        id: "1",
        kind: "invite_expired",
        severity: "high",
        title: "הזמנה שפגה",
        detail: "qa_probe@sitesecure.test · ws",
        href: "/admin/invitations",
      },
      {
        id: "2",
        kind: "invite_expired",
        severity: "high",
        title: "הזמנה שפגה",
        detail: "owner@acme.co.il · ws",
        href: "/admin/invitations",
      },
      {
        id: "3",
        kind: "invite_expired",
        severity: "high",
        title: "הזמנה שפגה",
        detail: "tech@acme.co.il · ws",
        href: "/admin/invitations",
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.count).toBe(3);
    expect(grouped[0]?.suspectedQaCount).toBe(1);
    expect(grouped[0]?.realCount).toBe(2);
  });

  it("groups repetitive machine activity", () => {
    const grouped = groupActivityItems([
      {
        id: "a",
        action: "workspace_beta_updated",
        created_at: "2026-09-30T23:34:01Z",
        summary: "ws1",
      },
      {
        id: "b",
        action: "workspace_beta_updated",
        created_at: "2026-09-30T23:35:01Z",
        summary: "ws2",
      },
      {
        id: "c",
        action: "invitation_accepted",
        created_at: "2026-09-30T22:00:00Z",
        summary: "owner joined",
      },
    ]);
    const beta = grouped.find((g) => g.action === "workspace_beta_updated");
    expect(beta?.count).toBe(2);
    expect(grouped.some((g) => g.action === "invitation_accepted")).toBe(true);
  });

  it("filters invites by scope heuristic and time window", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    const invites = [
      {
        id: "1",
        email: "owner@acme.co.il",
        workspace_id: "w1",
        role_key: "owner",
        status: "pending",
        created_at: "2026-09-30T10:00:00Z",
      },
      {
        id: "2",
        email: "qa_probe@sitesecure.test",
        workspace_id: "w2",
        role_key: "owner",
        status: "pending",
        created_at: "2026-09-30T11:00:00Z",
      },
      {
        id: "3",
        email: "old@acme.co.il",
        workspace_id: "w3",
        role_key: "technician",
        status: "pending",
        created_at: "2026-08-01T10:00:00Z",
      },
    ];
    expect(filterPendingInvites(invites, "hide_suspected_qa", "24h").map((i) => i.id)).toEqual(["1"]);
    expect(filterPendingInvites(invites, "all", "all").map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(withinWindow("2026-09-30T10:00:00Z", "24h", now)).toBe(true);
    expect(withinWindow("2026-08-01T10:00:00Z", "24h", now)).toBe(false);
  });

  it("maps system tones without inventing green", () => {
    expect(mapSystemTone("api", { api_ok: true }, true)).toBe("ok");
    expect(mapSystemTone("api", undefined, false)).toBe("danger");
    expect(mapSystemTone("web", { web_status: "unknown" })).toBe("disconnected");
    expect(mapSystemTone("backup", { backup_status: "unavailable" })).toBe("disconnected");
    expect(mapSystemTone("auth", { auth_status: "degraded" })).toBe("warning");
    expect(mapSystemTone("invite", { invite_flow_status: "unknown" })).toBe("disconnected");
    expect(mapSystemTone("quote", { quote_flow_status: "unknown" })).toBe("disconnected");
  });
});

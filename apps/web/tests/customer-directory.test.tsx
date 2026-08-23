import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@site-secure/ui";
import { Plus } from "lucide-react";
import {
  buildCustomerDirectoryRows,
  customerInitials,
  filterDirectoryRows,
  formatCustomerMeta,
  summarizeDirectory,
} from "../src/lib/customer-directory";

describe("Button icon alignment", () => {
  it("keeps icon and label on one flex row", () => {
    const { container } = render(
      <Button type="button">
        <Plus data-testid="plus-icon" />
        הצעת מחיר
      </Button>,
    );
    const content = container.querySelector("button > span.inline-flex");
    expect(content).toBeTruthy();
    expect(content?.className).toContain("items-center");
    expect(content?.className).toContain("whitespace-nowrap");
    expect(content?.className).toContain("gap-2");
    expect(screen.getByTestId("plus-icon")).toBeTruthy();
    expect(content?.textContent).toContain("הצעת מחיר");
  });
});

describe("customer directory helpers", () => {
  it("builds initials from Hebrew names", () => {
    expect(customerInitials("שנידי הלר")).toBe("שה");
    expect(customerInitials("איליה")).toBe("א");
  });

  it("aggregates operational counts without inventing data", () => {
    const rows = buildCustomerDirectoryRows({
      customers: [
        {
          id: "c1",
          display_name: "שנידי הלר",
          status: "active",
          type: "private",
          phone: "0585378423",
        },
      ],
      sites: [{ id: "s1", customer_id: "c1", name: "דירה" }],
      quotes: [
        {
          id: "q1",
          customer_id: "c1",
          site_id: null,
          owner_user_id: null,
          number: "1",
          status: "draft",
          workspace_id: "w",
          currency: "ILS",
          items: [],
          version: 1,
          total_gross: 0,
          validation: { can_send: false, gaps: [] },
        },
        {
          id: "q2",
          customer_id: "c1",
          site_id: null,
          owner_user_id: null,
          number: "2",
          status: "sent",
          workspace_id: "w",
          currency: "ILS",
          items: [],
          version: 1,
          total_gross: 0,
          validation: { can_send: false, gaps: [] },
        },
      ],
      projects: [
        {
          id: "p1",
          workspace_id: "w",
          name: "P",
          status: "planned",
          customer_id: "c1",
          created_at: "",
          updated_at: "",
        },
      ],
      serviceCalls: [
        {
          id: "sc1",
          workspace_id: "w",
          status: "open",
          priority: "normal",
          customer_id: "c1",
          site_id: "s1",
          title: "t",
          created_at: "",
          updated_at: "",
        },
        {
          id: "sc2",
          workspace_id: "w",
          status: "open",
          priority: "normal",
          customer_id: "c1",
          site_id: "s1",
          title: "t2",
          created_at: "",
          updated_at: "",
        },
        {
          id: "sc3",
          workspace_id: "w",
          status: "closed",
          priority: "normal",
          customer_id: "c1",
          site_id: "s1",
          title: "t3",
          created_at: "",
          updated_at: "",
        },
      ],
      leads: [
        {
          id: "l1",
          workspace_id: "w",
          title: "מצלמות",
          status: "visit_scheduling",
          source: "whatsapp",
          customer_id: "c1",
          created_at: "",
          updated_at: "",
        },
      ],
    });

    expect(rows[0].counts).toEqual({
      sites: 1,
      quotes: 2,
      projects: 1,
      service: 3,
      leads: 1,
      leadsNeedingAttention: 1,
    });
    expect(formatCustomerMeta(rows[0].counts)).toContain("אתר");
    expect(summarizeDirectory(rows).leadsNeedingAttention).toBe(1);
  });

  it("filters by lead attention and status", () => {
    const rows = buildCustomerDirectoryRows({
      customers: [
        { id: "c1", display_name: "A", status: "active" },
        { id: "c2", display_name: "B", status: "archived" },
      ],
      sites: [],
      quotes: [],
      projects: [],
      serviceCalls: [],
      leads: [
        {
          id: "l1",
          workspace_id: "w",
          title: "x",
          status: "visit_scheduling",
          source: "phone",
          customer_id: "c1",
          created_at: "",
          updated_at: "",
        },
      ],
    });
    expect(filterDirectoryRows(rows, { hasLeadAttention: true })).toHaveLength(1);
    expect(filterDirectoryRows(rows, { status: "archived" })).toHaveLength(1);
  });
});
